const { OpenAI } = require("openai");
const { VectorStore } = require("./vectoreStore");

/**
 * Advanced RAG Service with:
 * - Query Enhancement (rewriting, multi-query, HyDE)
 * - Hybrid Search (semantic + keyword)
 * - Re-ranking with relevance scoring
 * - Context compression and deduplication
 * - MMR (Maximal Marginal Relevance)
 */
class AdvancedRAG {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.vectorStore = VectorStore;
  }

  /**
   * Main retrieval method with advanced techniques
   */
  async retrieve(query, options = {}) {
    const {
      useQueryExpansion = true,
      useHybridSearch = true,
      useReranking = true,
      topK = 10,
      minRelevanceScore = 0.2, // Lowered from 0.3 to allow more table data through
      enableMMR = true,
      compressionTarget = 0.95, // Increased from 0.7 - less aggressive compression
    } = options;

    console.log("\n🔍 Advanced RAG Retrieval Started");
    console.log("Original Query:", query);

    // Step 1: Query Enhancement
    let enhancedQueries = [query];
    if (useQueryExpansion) {
      enhancedQueries = await this.expandQuery(query);
      console.log("📝 Expanded Queries:", enhancedQueries);
    }

    // Step 2: Hybrid Retrieval (Semantic + Keyword)
    let allDocuments = [];
    for (const enhancedQuery of enhancedQueries) {
      if (useHybridSearch) {
        const hybridDocs = await this.hybridSearch(enhancedQuery, topK);
        allDocuments.push(...hybridDocs);
      } else {
        const semanticDocs = await this.vectorStore.retrieveContext(
          enhancedQuery,
          topK,
          0.3, // Lower threshold for more recall
        );
        allDocuments.push(...this.parseDocuments(semanticDocs));
      }
    }

    console.log(`📚 Retrieved ${allDocuments.length} documents before dedup`);

    // Step 3: Deduplicate by content similarity
    const deduped = this.deduplicateDocuments(allDocuments);
    console.log(`🔄 After deduplication: ${deduped.length} documents`);

    // Step 4: Re-rank with relevance scoring
    let rankedDocs = deduped;
    if (useReranking) {
      rankedDocs = await this.rerankDocuments(query, deduped);
      console.log("⭐ Re-ranked documents");
    }

    // Step 5: Filter by relevance threshold
    let filtered = rankedDocs.filter(
      (doc) => doc.relevanceScore >= minRelevanceScore,
    );
    console.log(
      `🎯 After relevance filtering (>=${minRelevanceScore}): ${filtered.length} documents`,
    );

    // Fallback: If no documents pass filter, take top 3 with lower threshold
    if (filtered.length === 0 && rankedDocs.length > 0) {
      console.log(
        "⚠️  No docs passed filter, using top 3 with lower threshold",
      );
      filtered = rankedDocs.slice(0, 3);
    }

    // Step 6: Apply MMR for diversity
    let finalDocs = filtered;
    if (enableMMR) {
      finalDocs = this.applyMMR(filtered, topK, 0.5); // lambda=0.5 balances relevance/diversity
      console.log(`🎨 After MMR diversity: ${finalDocs.length} documents`);
    }

    // Step 7: Context Compression
    const compressed = await this.compressContext(
      query,
      finalDocs,
      compressionTarget,
    );

    return compressed;
  }

  /**
   * Query Expansion: Generate multiple queries from original
   */
  async expandQuery(query) {
    try {
      const prompt = `Given the user query, generate 2 alternative phrasings that capture the same intent but use different wording.
This helps retrieve more relevant documents.

User Query: "${query}"

Generate 2 alternative queries (one per line, no numbering):`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 150,
      });

      const alternatives = response.choices[0].message.content
        .trim()
        .split("\n")
        .filter((q) => q.trim())
        .map((q) => q.replace(/^[-•\d.)\s]+/, "").trim())
        .slice(0, 2);

      return [query, ...alternatives];
    } catch (error) {
      console.error("Query expansion error:", error);
      return [query];
    }
  }

  /**
   * Hybrid Search: Combine semantic and keyword search
   */
  async hybridSearch(query, topK = 10) {
    try {
      // Detect schedule-related queries and boost keyword search
      const isScheduleQuery =
        /series|schedule|dates|when.*conducted|test.*schedule/i.test(query);
      const isMathsCourseQuery =
        /math.*course|mathematics.*course|pre.*medical.*course/i.test(query);
      const isNETTestQuery =
        /NET.*test|engineering.*NET|NET.*engineering|subjects.*NET|NET.*subjects|weightings/i.test(
          query,
        );
      const isFeeQuery =
        /fee|fees|tuition|cost|charges|price|payment|financial/i.test(query);
      const isPreMedEligibility =
        /pre.*med|pre.*medical.*engineering|pre.*medical.*apply/i.test(query);
      const isResultQuery =
        /result|results|announcement|announced|upload/i.test(query);
      const isBioinformaticsQuery = /bioinformatics|bioinformatic/i.test(query);
      const isEligibilityQuery =
        /eligibility|eligible|apply|admission|FSc.*arts|ICS|pre.*engineering|criteria/i.test(
          query,
        );

      // Semantic search
      const semanticResults = await this.vectorStore.retrieveContext(
        query,
        topK,
        0.3,
      );
      const semanticDocs = this.parseDocuments(semanticResults);

      // Keyword search (PostgreSQL FTS) - boosted for special queries
      const needsBoost =
        isScheduleQuery ||
        isMathsCourseQuery ||
        isNETTestQuery ||
        isFeeQuery ||
        isPreMedEligibility ||
        isResultQuery ||
        isBioinformaticsQuery ||
        isEligibilityQuery;
      const keywordTopK = needsBoost ? topK * 2 : topK;
      const keywordResults = await this.vectorStore.fallbackSearch(
        query,
        keywordTopK,
      );
      const keywordDocs = this.parseDocuments(keywordResults);

      // Add explicit searches for specific content types
      let specialDocs = [];

      if (isScheduleQuery && /series|NET/i.test(query)) {
        console.log(
          "🔍 Schedule query detected, searching for NET table explicitly",
        );
        const netSearch = await this.vectorStore.fallbackSearch(
          "NET TEST SCHEDULE TABLE Series",
          5,
        );
        specialDocs.push(...this.parseDocuments(netSearch));
      }

      if (isMathsCourseQuery) {
        console.log(
          "🔍 Maths course query detected, searching for course notice explicitly",
        );
        const mathsSearch = await this.vectorStore.fallbackSearch(
          "Mathematics course Pre Medical connected.nust.edu.pk",
          5,
        );
        specialDocs.push(...this.parseDocuments(mathsSearch));
      }

      if (isNETTestQuery) {
        console.log(
          "🔍 NET test query detected, searching for subjects and weightings explicitly",
        );
        const netTestSearch = await this.vectorStore.fallbackSearch(
          "SUBJECTS INCLUDED IN NET WITH WEIGHTINGS Engineering Mathematics Physics",
          5,
        );
        specialDocs.push(...this.parseDocuments(netTestSearch));
      }

      if (isFeeQuery) {
        console.log(
          "🔍 Fee query detected, searching for fee structure explicitly",
        );
        const feeSearch = await this.vectorStore.fallbackSearch(
          "Fee Structure National Students Tuition Admission Processing Security Deposit",
          5,
        );
        specialDocs.push(...this.parseDocuments(feeSearch));
      }

      if (isPreMedEligibility) {
        console.log(
          "🔍 Pre-Medical eligibility query detected, searching explicitly",
        );
        const preMedSearch = await this.vectorStore.fallbackSearch(
          "Pre-Medical group equivalent qualification applying Engineering mandatory Mathematics course 8 weeks",
          5,
        );
        specialDocs.push(...this.parseDocuments(preMedSearch));
      }

      if (isResultQuery && /NET|series/i.test(query)) {
        console.log(
          "🔍 Result query detected, searching for result announcement",
        );
        const resultSearch = await this.vectorStore.fallbackSearch(
          "Result NET-2026 Series uploaded login account",
          5,
        );
        specialDocs.push(...this.parseDocuments(resultSearch));
      }

      if (isBioinformaticsQuery) {
        console.log(
          "🔍 Bioinformatics query detected, searching for eligibility",
        );
        const bioSearch = await this.vectorStore.fallbackSearch(
          "BS Bioinformatics NET-Engineering additional registration fee separate",
          5,
        );
        specialDocs.push(...this.parseDocuments(bioSearch));
      }

      if (isEligibilityQuery) {
        console.log(
          "🔍 Eligibility query detected, searching for admission criteria",
        );
        // Search for the specific section that defines eligible backgrounds
        const eligibilitySearch1 = await this.vectorStore.fallbackSearch(
          "NET-Engineering HSSC Pre-Engineering Pre-Medical ICS group candidates seeking admission",
          5,
        );
        specialDocs.push(...this.parseDocuments(eligibilitySearch1));

        // Also search for the streams definition
        const eligibilitySearch2 = await this.vectorStore.fallbackSearch(
          "standard defined streams academic background Mathematics Physics Chemistry Biology Computer Science",
          5,
        );
        specialDocs.push(...this.parseDocuments(eligibilitySearch2));
      }

      // Combine and score - give more weight to keyword for special queries
      const semanticWeight = needsBoost ? 0.3 : 0.6;
      const keywordWeight = needsBoost ? 0.7 : 0.4;

      const combined = this.combineSearchResults(
        semanticDocs,
        [...keywordDocs, ...specialDocs],
        semanticWeight,
        keywordWeight,
      );

      return combined;
    } catch (error) {
      console.error("Hybrid search error:", error);
      const fallback = await this.vectorStore.retrieveContext(query, topK);
      return this.parseDocuments(fallback);
    }
  }

  /**
   * Parse document results from different formats
   */
  parseDocuments(results) {
    if (typeof results === "string") {
      // String format from retrieveContext
      return results
        .split("\n\n---\n\n")
        .filter((content) => content.trim())
        .map((content, index) => ({
          content: content.replace(/^Source:.*\n/, "").trim(),
          source: content.match(/Source:\s*(.+)/)?.[1] || "Unknown",
          id: `doc_${index}`,
          relevanceScore: 0.5, // Default score
        }));
    } else if (Array.isArray(results)) {
      // Array format
      return results.map((doc, index) => ({
        content: doc.content || "",
        source: doc.metadata?.source || doc.source || "Unknown",
        metadata: doc.metadata || {},
        id: doc.id || `doc_${index}`,
        relevanceScore: doc.similarity || 0.5,
      }));
    }
    return [];
  }

  /**
   * Combine semantic and keyword search results with weighted scoring
   */
  combineSearchResults(
    semanticDocs,
    keywordDocs,
    semanticWeight,
    keywordWeight,
  ) {
    const scoreMap = new Map();

    // Score semantic results
    semanticDocs.forEach((doc, index) => {
      const normalizedScore = 1 - index / semanticDocs.length;
      scoreMap.set(doc.content, {
        ...doc,
        relevanceScore: normalizedScore * semanticWeight,
      });
    });

    // Add/merge keyword results
    keywordDocs.forEach((doc, index) => {
      const normalizedScore = 1 - index / keywordDocs.length;
      const existing = scoreMap.get(doc.content);
      if (existing) {
        existing.relevanceScore += normalizedScore * keywordWeight;
      } else {
        scoreMap.set(doc.content, {
          ...doc,
          relevanceScore: normalizedScore * keywordWeight,
        });
      }
    });

    return Array.from(scoreMap.values()).sort(
      (a, b) => b.relevanceScore - a.relevanceScore,
    );
  }

  /**
   * Re-rank documents using LLM-based relevance scoring
   */
  async rerankDocuments(query, documents) {
    try {
      // For efficiency, only re-rank top candidates
      const toRerank = documents.slice(0, 20);

      const rerankedPromises = toRerank.map(async (doc, index) => {
        try {
          const prompt = `Rate the relevance of this document to the query on a scale of 0-10.
Consider:
- Direct answer to query: high score
- Related but not directly answering: medium score
- Unrelated or tangential: low score

Query: "${query}"

Document: "${doc.content.substring(0, 500)}"

Respond with ONLY a number from 0-10:`;

          const response = await this.openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 5,
          });

          const score = parseFloat(response.choices[0].message.content.trim());
          return {
            ...doc,
            relevanceScore: isNaN(score) ? doc.relevanceScore : score / 10,
            rerankPosition: index,
          };
        } catch (error) {
          console.error(`Re-rank error for doc ${index}:`, error.message);
          return { ...doc, rerankPosition: index };
        }
      });

      const reranked = await Promise.all(rerankedPromises);

      // Add non-reranked documents with lower scores
      const remaining = documents.slice(20).map((doc) => ({
        ...doc,
        relevanceScore: doc.relevanceScore * 0.5,
      }));

      return [...reranked, ...remaining].sort(
        (a, b) => b.relevanceScore - a.relevanceScore,
      );
    } catch (error) {
      console.error("Re-ranking error:", error);
      return documents;
    }
  }

  /**
   * Deduplicate documents by content similarity
   */
  deduplicateDocuments(documents) {
    const unique = [];
    const seen = new Set();

    for (const doc of documents) {
      // Simple dedup by normalized content
      const normalized = doc.content
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 200);

      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(doc);
      }
    }

    return unique;
  }

  /**
   * Apply Maximal Marginal Relevance for diversity
   * Balances relevance with diversity to avoid redundant chunks
   */
  applyMMR(documents, k, lambda = 0.5) {
    if (documents.length <= k) return documents.slice(0, k);

    const selected = [];
    const remaining = [...documents];

    // Select first (most relevant) document
    selected.push(remaining.shift());

    while (selected.length < k && remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const doc = remaining[i];

        // Relevance score
        const relevance = doc.relevanceScore;

        // Diversity score (inverse similarity to already selected)
        const diversityScores = selected.map((selectedDoc) =>
          this.calculateSimilarity(doc.content, selectedDoc.content),
        );
        const maxSimilarity = Math.max(...diversityScores);
        const diversity = 1 - maxSimilarity;

        // MMR score
        const mmrScore = lambda * relevance + (1 - lambda) * diversity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      selected.push(remaining.splice(bestIdx, 1)[0]);
    }

    return selected;
  }

  /**
   * Calculate text similarity (Jaccard similarity for simplicity)
   */
  calculateSimilarity(text1, text2) {
    const tokens1 = new Set(text1.toLowerCase().split(/\s+/));
    const tokens2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return intersection.size / union.size;
  }

  /**
   * Compress context using LLM to extract only relevant information
   */
  async compressContext(query, documents, targetRatio = 0.7) {
    try {
      // Calculate target length
      const totalLength = documents.reduce(
        (sum, doc) => sum + doc.content.length,
        0,
      );
      const targetLength = Math.floor(totalLength * targetRatio);

      // If already under target, return as-is
      if (totalLength <= targetLength) {
        console.log(
          `📦 No compression needed (${totalLength} chars, target: ${targetLength})`,
        );
        return this.formatContext(documents);
      }

      // Combine all documents
      const combinedContext = this.formatContext(documents);

      // Create compression prompt with emphasis on preserving structured data
      const prompt = `You are a context compression expert. Reduce the following context to approximately ${targetLength} characters while keeping the information relevant to answering this query. 

IMPORTANT: Preserve ALL table data, dates, numbers, and structured information exactly as they appear. Keep relationships between columns clear (e.g., "Series-3: Islamabad - Apr 2026"). Remove only redundant explanatory text.

Query: "${query}"

Context:
${combinedContext.substring(0, 8000)}

Provide a compressed version maintaining ALL structured data, dates, and key facts:`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: Math.floor(targetLength / 2.5), // More tokens = less aggressive compression
      });

      const compressed = response.choices[0].message.content.trim();

      console.log(
        `📊 Compression: ${totalLength} chars → ${compressed.length} chars (${Math.round((compressed.length / totalLength) * 100)}%)`,
      );

      return compressed;
    } catch (error) {
      console.error("Context compression error:", error);
      // Fallback to truncation
      return this.formatContext(documents.slice(0, 5));
    }
  }

  /**
   * Format documents into context string
   */
  formatContext(documents) {
    return documents
      .map((doc, idx) => {
        const source = doc.source || doc.metadata?.source || "Unknown";
        const title = doc.metadata?.title || "";
        return `[Document ${idx + 1}] Source: ${source}${title ? ` (${title})` : ""}\n${doc.content}`;
      })
      .join("\n\n---\n\n");
  }

  /**
   * HyDE: Hypothetical Document Embeddings
   * Generate a hypothetical answer and use it for retrieval
   */
  async hydeRetrieval(query, topK = 10) {
    try {
      const prompt = `Given this question, write a detailed, factual answer as if you had perfect knowledge.

Question: "${query}"

Detailed Answer:`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
      });

      const hypotheticalDoc = response.choices[0].message.content.trim();

      // Use hypothetical document for retrieval
      const results = await this.vectorStore.retrieveContext(
        hypotheticalDoc,
        topK,
        0.4,
      );

      return this.parseDocuments(results);
    } catch (error) {
      console.error("HyDE error:", error);
      const fallback = await this.vectorStore.retrieveContext(query, topK);
      return this.parseDocuments(fallback);
    }
  }

  /**
   * Query routing: Determine best retrieval strategy based on query type
   */
  async routeQuery(query) {
    try {
      const prompt = `Classify this query into ONE category:
1. FACTUAL - Asking for specific facts, numbers, dates, requirements
2. COMPARISON - Comparing options, programs, or alternatives
3. PROCEDURAL - How to do something, steps, processes
4. CONCEPTUAL - Understanding concepts, explanations

Query: "${query}"

Category (one word):`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 10,
      });

      const category = response.choices[0].message.content.trim().toUpperCase();

      // Route to different strategies (adjusted thresholds)
      const strategies = {
        FACTUAL: {
          topK: 10,
          minRelevance: 0.15,
          enableMMR: false,
          compressionTarget: 1.0,
        },
        COMPARISON: {
          topK: 12,
          minRelevance: 0.2,
          enableMMR: true,
          compressionTarget: 0.95,
        },
        PROCEDURAL: {
          topK: 8,
          minRelevance: 0.25,
          enableMMR: true,
          compressionTarget: 0.95,
        },
        CONCEPTUAL: {
          topK: 10,
          minRelevance: 0.2,
          enableMMR: true,
          compressionTarget: 0.95,
        },
      };

      return strategies[category] || strategies.FACTUAL;
    } catch (error) {
      console.error("Query routing error:", error);
      return { topK: 10, minRelevance: 0.5, enableMMR: true };
    }
  }

  /**
   * Smart retrieval with automatic query routing
   */
  async smartRetrieve(query) {
    const strategy = await this.routeQuery(query);
    console.log("🎯 Query Strategy:", strategy);

    return this.retrieve(query, {
      useQueryExpansion: true,
      useHybridSearch: true,
      useReranking: true,
      topK: strategy.topK,
      minRelevanceScore: strategy.minRelevance,
      enableMMR: strategy.enableMMR,
      compressionTarget: strategy.compressionTarget || 0.95,
    });
  }

  /**
   * Fast retrieval mode - optimized for speed
   * Disables re-ranking and compression for real-time use
   */
  async fastRetrieve(query) {
    console.log("⚡ Fast Retrieval Mode");

    return this.retrieve(query, {
      useQueryExpansion: false, // Skip for speed
      useHybridSearch: true, // Keep hybrid (fast enough)
      useReranking: false, // Skip expensive LLM calls
      topK: 8,
      minRelevanceScore: 0.3,
      enableMMR: true, // Keep diversity (fast)
      compressionTarget: 1.0, // No compression
    });
  }
}

module.exports = { AdvancedRAG };
