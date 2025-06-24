require("dotenv").config();
const {createClient} = require("@supabase/supabase-js");
const {OpenAI} = require("openai");

class VectorStore {
  static #instance;

  static getInstance(){
    if (!VectorStore.#instance) {
      VectorStore.#instance = new VectorStore();
    }
    return VectorStore.#instance;
  }
  constructor() {
    if (VectorStore.#instance) {
      throw new Error("Use VectorStore.getInstance() instead of new VectorStore()");
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.supabase = createClient(
      process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );
  }
  async initializeDatabase() {
    try {
      const { error: extensionError } = await this.supabase.rpc(
        "enable_pgvector"
      );
      if (
        extensionError &&
        !extensionError.message.includes("already exists")
      ) {
        console.error("Error enabling pgvector:", extensionError);
      }

      const { error: tableError } = await this.supabase.rpc(
        "create_documents_table"
      );
      if (tableError && !tableError.message.includes("already exists")) {
        console.error("Error creating table:", tableError);
      }

      console.log("Database initialized successfully");
    } catch (error) {
      console.error("Database initialization error:", error);
      throw error;
    }
  }

  async addDocuments(documents) {
    console.log(
      `Adding ${documents.length} documents to Supabase vector store...`
    );

    const batch = [];
    for (const doc of documents) {
      try {
        const embedding = await this.generateEmbedding(doc.content);
        const documentRecord = {
          content: doc.content,
          metadata: doc.metadata || {},
          embedding: embedding,
          created_at: new Date().toISOString(),
        };
        batch.push(documentRecord);
        if (batch.length >= 10) {
          await this.insertBatch(batch);
          batch.length = 0;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error("Error processing document:", error);
      }
    }
    if (batch.length > 0) {
      await this.insertBatch(batch);
    }

    console.log(`Successfully added documents to vector store`);
  }

  async insertBatch(batch) {
    const { error } = await this.supabase.from("documents").insert(batch);
    if (error) {
      console.error("Error inserting batch:", error);
      throw error;
    }
  }
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text.substring(0, 8000),
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  async retrieveContext(
    query,
    topK = 5,
    similarityThreshold = 0.7
  ) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const { data, error } = await this.supabase.rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_threshold: similarityThreshold,
        match_count: topK,
      });
      if (error) {
        console.error("Vector search error:", error);
        // Fallback to regular search
        return await this.fallbackSearch(query, topK);
      }
      if (!data || data?.length === 0) {
        return "No relevant information found in the knowledge base.";
      }

      // Build context from search results
      const context = data
        .map((doc) => {
          const source = doc.metadata?.source || "Unknown source";
          const title = doc.metadata?.title || "";
          return `Source: ${source}${title ? ` (${title})` : ""}\n${
            doc.content
          }`;
        })
        .join("\n\n---\n\n");

      return context;
    } catch (error) {
      console.error("Context retrieval error:", error);
      return await this.fallbackSearch(query, topK);
    }
  }
  async fallbackSearch(query, topK = 5) {
    try {
      // Simple text search as fallback
      const { data, error } = await this.supabase
        .from("documents")
        .select("content, metadata")
        .textSearch("content", query, {
          type: "websearch",
          config: "english",
        })
        .limit(topK);

      if (error || !data) {
        return "Unable to retrieve relevant information at this time.";
      }

      return data
        .map((doc) => {
          const source = doc.metadata?.source || "Unknown source";
          return `Source: ${source}\n${doc.content}`;
        })
        .join("\n\n---\n\n");
    } catch (error) {
      console.error("Fallback search error:", error);
      return "Knowledge base temporarily unavailable.";
    }
  }
  async getStats() {
    try {
      const { count, error: countError } = await this.supabase
        .from("documents")
        .select("*", { count: "exact", head: true });
      const { data: typeStats, error: typeError } = await this.supabase
        .from("documents")
        .select("metadata")
        .limit(1000); // Limit for performance

      if (countError || typeError) {
        return { error: "Unable to fetch statistics" };
      }

      const documentTypes = {};
      const sources = new Set();

      typeStats?.forEach((doc) => {
        const type = doc.metadata?.type || "unknown";
        const source = doc.metadata?.source;

        documentTypes[type] = (documentTypes[type] || 0) + 1;
        if (source) sources.add(source);
      });

      return {
        totalDocuments: count,
        documentTypes,
        sources: Array.from(sources),
        uniqueSources: sources.size,
      };
    } catch (error) {
      console.error("Stats error:", error);
      return { error: "Unable to fetch statistics" };
    }
  }
  async clear() {
    try {
      const { error } = await this.supabase
        .from("documents")
        .delete()
        .neq("id", 0);

      if (error) {
        console.error("Clear error:", error);
        throw error;
      }

      console.log("Vector store cleared successfully");
    } catch (error) {
      console.error("Error clearing vector store:", error);
      throw error;
    }
  }

  async deleteBySource(source) {
    try {
      const { error } = await this.supabase
        .from("documents")
        .delete()
        .eq("metadata->>source", source);

      if (error) {
        console.error("Delete by source error:", error);
        throw error;
      }

      console.log(`Documents from source "${source}" deleted successfully`);
    } catch (error) {}
  }
  async searchByMetadata(key, value, limit = 10) {
    try {
      const { data, error } = await this.supabase
        .from("documents")
        .select("*")
        .eq(`metadata->>${key}`, value)
        .limit(limit);

      if (error) {
        console.error("Metadata search error:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Error searching by metadata:", error);
      return [];
    }
  }
}

module.exports = {
  VectorStore: VectorStore.getInstance(),
};