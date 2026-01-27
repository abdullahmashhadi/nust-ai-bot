const { OpenAI } = require("openai");

/**
 * RAG Evaluation Service
 * Evaluates retrieval quality and provides metrics
 */
class RAGEvaluator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.evaluationHistory = [];
  }

  /**
   * Evaluate retrieval quality for a query-context pair
   */
  async evaluateRetrieval(query, retrievedContext, groundTruthAnswer = null) {
    try {
      const metrics = {};

      // 1. Context Relevance Score
      metrics.relevance = await this.scoreRelevance(query, retrievedContext);

      // 2. Context Completeness Score
      metrics.completeness = await this.scoreCompleteness(
        query,
        retrievedContext,
      );

      // 3. Context Conciseness Score
      metrics.conciseness = this.scoreConciseness(retrievedContext);

      // 4. If ground truth provided, calculate faithfulness
      if (groundTruthAnswer) {
        metrics.faithfulness = await this.scoreFaithfulness(
          retrievedContext,
          groundTruthAnswer,
        );
      }

      // 5. Overall score
      metrics.overall = this.calculateOverallScore(metrics);

      // Store for analysis
      this.evaluationHistory.push({
        timestamp: new Date(),
        query,
        metrics,
        contextLength: retrievedContext.length,
      });

      return metrics;
    } catch (error) {
      console.error("Evaluation error:", error);
      return null;
    }
  }

  /**
   * Score how relevant the context is to the query
   */
  async scoreRelevance(query, context) {
    try {
      const prompt = `Rate how relevant this retrieved context is for answering the query.

Query: "${query}"

Context: "${context.substring(0, 2000)}"

Rate from 0-10 where:
- 10: Perfectly relevant, directly answers the query
- 7-9: Highly relevant, contains most needed information
- 4-6: Somewhat relevant, contains some useful information
- 1-3: Barely relevant, mostly unrelated
- 0: Completely irrelevant

Respond with ONLY a number:`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 5,
      });

      const score = parseFloat(response.choices[0].message.content.trim());
      return isNaN(score) ? 5 : score / 10;
    } catch (error) {
      console.error("Relevance scoring error:", error);
      return 0.5;
    }
  }

  /**
   * Score how complete the context is for answering the query
   */
  async scoreCompleteness(query, context) {
    try {
      const prompt = `Rate how complete this context is for fully answering the query.

Query: "${query}"

Context: "${context.substring(0, 2000)}"

Rate from 0-10 where:
- 10: Contains all information needed for complete answer
- 7-9: Contains most information, minor gaps
- 4-6: Partial information, significant gaps
- 1-3: Very incomplete, major information missing
- 0: Missing all necessary information

Respond with ONLY a number:`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 5,
      });

      const score = parseFloat(response.choices[0].message.content.trim());
      return isNaN(score) ? 5 : score / 10;
    } catch (error) {
      console.error("Completeness scoring error:", error);
      return 0.5;
    }
  }

  /**
   * Score conciseness (penalize excessive redundancy)
   */
  scoreConciseness(context) {
    const length = context.length;
    const uniqueWords = new Set(context.toLowerCase().split(/\s+/)).size;
    const totalWords = context.split(/\s+/).length;

    // Calculate redundancy ratio
    const redundancyRatio = uniqueWords / totalWords;

    // Penalize very long contexts and high redundancy
    let score = 1.0;

    if (length > 5000) score -= 0.2;
    if (length > 8000) score -= 0.2;
    if (redundancyRatio < 0.4) score -= 0.3; // High redundancy

    return Math.max(0, score);
  }

  /**
   * Score faithfulness of answer to context (if ground truth provided)
   */
  async scoreFaithfulness(context, answer) {
    try {
      const prompt = `Does this answer only use information from the context, without hallucination?

Context: "${context.substring(0, 2000)}"

Answer: "${answer}"

Rate from 0-10 where:
- 10: Perfectly faithful, every claim is in context
- 7-9: Mostly faithful, minor extrapolations
- 4-6: Some claims not in context
- 1-3: Many claims not in context
- 0: Completely hallucinated

Respond with ONLY a number:`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 5,
      });

      const score = parseFloat(response.choices[0].message.content.trim());
      return isNaN(score) ? 5 : score / 10;
    } catch (error) {
      console.error("Faithfulness scoring error:", error);
      return 0.5;
    }
  }

  /**
   * Calculate overall score from individual metrics
   */
  calculateOverallScore(metrics) {
    const weights = {
      relevance: 0.4,
      completeness: 0.3,
      conciseness: 0.2,
      faithfulness: 0.1,
    };

    let score = 0;
    let totalWeight = 0;

    for (const [metric, weight] of Object.entries(weights)) {
      if (metrics[metric] !== undefined) {
        score += metrics[metric] * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * Get evaluation statistics
   */
  getStatistics() {
    if (this.evaluationHistory.length === 0) {
      return { message: "No evaluations yet" };
    }

    const metrics = ["relevance", "completeness", "conciseness", "overall"];
    const stats = {};

    for (const metric of metrics) {
      const values = this.evaluationHistory
        .map((e) => e.metrics[metric])
        .filter((v) => v !== undefined);

      if (values.length > 0) {
        stats[metric] = {
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
        };
      }
    }

    stats.totalEvaluations = this.evaluationHistory.length;
    stats.averageContextLength =
      this.evaluationHistory.reduce((sum, e) => sum + e.contextLength, 0) /
      this.evaluationHistory.length;

    return stats;
  }

  /**
   * Get recent evaluations
   */
  getRecentEvaluations(limit = 10) {
    return this.evaluationHistory.slice(-limit).reverse();
  }

  /**
   * Reset evaluation history
   */
  reset() {
    this.evaluationHistory = [];
  }
}

module.exports = { RAGEvaluator };
