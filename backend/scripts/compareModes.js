require("dotenv").config();
const { AdvancedRAG } = require("../src/services/AdvancedRAG");
const { RAGEvaluator } = require("../src/services/RAGEvaluator");

/**
 * Compare all three RAG modes on a single query
 * Run: node scripts/compareModes.js "your query here"
 */

async function compareModes() {
  const query = process.argv[2];

  if (!query) {
    console.log('Usage: node scripts/compareModes.js "your question"');
    console.log("\nExample:");
    console.log('  node scripts/compareModes.js "What is NUST admission fee?"');
    process.exit(1);
  }

  console.log("\n🔍 RAG Mode Comparison");
  console.log("=".repeat(80));
  console.log(`Query: "${query}"\n`);

  const rag = new AdvancedRAG();
  const evaluator = new RAGEvaluator();
  const results = [];

  // Test Fast Mode
  console.log("⚡ FAST MODE (No re-ranking, no compression)");
  console.log("-".repeat(80));
  let start = Date.now();
  try {
    const fastContext = await rag.fastRetrieve(query);
    const fastTime = Date.now() - start;
    const fastMetrics = await evaluator.evaluateRetrieval(query, fastContext);

    console.log(`  ⏱️  Time: ${fastTime}ms`);
    console.log(`  📏 Context: ${fastContext.length} chars`);
    console.log(`  ⭐ Relevance: ${(fastMetrics.relevance * 100).toFixed(1)}%`);
    console.log(
      `  📊 Completeness: ${(fastMetrics.completeness * 100).toFixed(1)}%`,
    );
    console.log(`  🎯 Overall: ${(fastMetrics.overall * 100).toFixed(1)}%\n`);

    results.push({
      mode: "Fast",
      time: fastTime,
      length: fastContext.length,
      metrics: fastMetrics,
    });
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
  }

  // Test Balanced Mode
  console.log("⚖️  BALANCED MODE (Moderate compression, smart routing)");
  console.log("-".repeat(80));
  start = Date.now();
  try {
    const balancedContext = await rag.retrieve(query, {
      useQueryExpansion: true,
      useHybridSearch: true,
      useReranking: true,
      topK: 8,
      minRelevanceScore: 0.35,
      enableMMR: true,
      compressionTarget: 0.85,
    });
    const balancedTime = Date.now() - start;
    const balancedMetrics = await evaluator.evaluateRetrieval(
      query,
      balancedContext,
    );

    console.log(`  ⏱️  Time: ${balancedTime}ms`);
    console.log(`  📏 Context: ${balancedContext.length} chars`);
    console.log(
      `  ⭐ Relevance: ${(balancedMetrics.relevance * 100).toFixed(1)}%`,
    );
    console.log(
      `  📊 Completeness: ${(balancedMetrics.completeness * 100).toFixed(1)}%`,
    );
    console.log(
      `  🎯 Overall: ${(balancedMetrics.overall * 100).toFixed(1)}%\n`,
    );

    results.push({
      mode: "Balanced",
      time: balancedTime,
      length: balancedContext.length,
      metrics: balancedMetrics,
    });
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
  }

  // Test Quality Mode
  console.log("💎 QUALITY MODE (Full advanced RAG, best quality)");
  console.log("-".repeat(80));
  start = Date.now();
  try {
    const qualityContext = await rag.smartRetrieve(query);
    const qualityTime = Date.now() - start;
    const qualityMetrics = await evaluator.evaluateRetrieval(
      query,
      qualityContext,
    );

    console.log(`  ⏱️  Time: ${qualityTime}ms`);
    console.log(`  📏 Context: ${qualityContext.length} chars`);
    console.log(
      `  ⭐ Relevance: ${(qualityMetrics.relevance * 100).toFixed(1)}%`,
    );
    console.log(
      `  📊 Completeness: ${(qualityMetrics.completeness * 100).toFixed(1)}%`,
    );
    console.log(
      `  🎯 Overall: ${(qualityMetrics.overall * 100).toFixed(1)}%\n`,
    );

    results.push({
      mode: "Quality",
      time: qualityTime,
      length: qualityContext.length,
      metrics: qualityMetrics,
    });
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}\n`);
  }

  // Comparison Summary
  console.log("=".repeat(80));
  console.log("📊 COMPARISON SUMMARY");
  console.log("=".repeat(80));

  if (results.length < 2) {
    console.log("Not enough results to compare");
    process.exit(1);
  }

  // Find best in each category
  const fastest = results.reduce((a, b) => (a.time < b.time ? a : b));
  const shortest = results.reduce((a, b) => (a.length < b.length ? a : b));
  const bestRelevance = results.reduce((a, b) =>
    a.metrics.relevance > b.metrics.relevance ? a : b,
  );
  const bestOverall = results.reduce((a, b) =>
    a.metrics.overall > b.metrics.overall ? a : b,
  );

  console.log(`\n🏆 Winners:`);
  console.log(`  ⚡ Fastest: ${fastest.mode} (${fastest.time}ms)`);
  console.log(`  📏 Most Concise: ${shortest.mode} (${shortest.length} chars)`);
  console.log(
    `  ⭐ Best Relevance: ${bestRelevance.mode} (${(bestRelevance.metrics.relevance * 100).toFixed(1)}%)`,
  );
  console.log(
    `  🎯 Best Overall: ${bestOverall.mode} (${(bestOverall.metrics.overall * 100).toFixed(1)}%)`,
  );

  // Recommendations
  console.log("\n💡 RECOMMENDATIONS:");

  const qualityDiff =
    results.find((r) => r.mode === "Quality")?.metrics.overall -
    results.find((r) => r.mode === "Fast")?.metrics.overall;
  const timeDiff =
    results.find((r) => r.mode === "Quality")?.time /
    results.find((r) => r.mode === "Fast")?.time;

  if (qualityDiff < 0.05) {
    console.log(
      "  ✅ Fast mode recommended - minimal quality difference, much faster",
    );
  } else if (timeDiff > 5) {
    console.log(
      "  ⚖️  Balanced mode recommended - best speed/quality trade-off",
    );
  } else {
    console.log("  💎 Quality mode acceptable - speed impact is manageable");
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Comparison Complete!");
  console.log("=".repeat(80) + "\n");

  process.exit(0);
}

compareModes().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
