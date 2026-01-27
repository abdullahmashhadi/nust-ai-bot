require("dotenv").config();
const { VectorStore } = require("../src/services/vectoreStore");
const { AdvancedRAG } = require("../src/services/AdvancedRAG");
const { RAGEvaluator } = require("../src/services/RAGEvaluator");

/**
 * Test script to compare Naive RAG vs Advanced RAG
 * Run: node scripts/testRAG.js
 */

const testQueries = [
  "What is the NUST admission fee for BSCS?",
  "Tell me about NUST NET test",
  "What are the eligibility requirements for undergraduate programs?",
  "Compare BSCS and BSSE programs",
  "How do I apply for NUST admission?",
  "What is the fee structure for Engineering programs?",
  "Tell me about NUST scholarships",
  "What is the merit closing for Computer Science at SEECS?",
];

async function compareRAG() {
  const advancedRAG = new AdvancedRAG();
  const evaluator = new RAGEvaluator();

  console.log("🔬 RAG Comparison Test\n");
  console.log("=".repeat(80));

  const results = {
    naive: [],
    advanced: [],
  };

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n📝 Query ${i + 1}/${testQueries.length}: "${query}"`);
    console.log("-".repeat(80));

    // Test Naive RAG
    console.log("\n🔵 NAIVE RAG:");
    const naiveStart = Date.now();
    const naiveContext = await VectorStore.retrieveContext(query, 10, 0.5);
    const naiveTime = Date.now() - naiveStart;
    const naiveMetrics = await evaluator.evaluateRetrieval(query, naiveContext);

    console.log(`  ⏱️  Time: ${naiveTime}ms`);
    console.log(`  📏 Context Length: ${naiveContext.length} chars`);
    console.log(
      `  ⭐ Relevance: ${(naiveMetrics.relevance * 100).toFixed(1)}%`,
    );
    console.log(
      `  📊 Completeness: ${(naiveMetrics.completeness * 100).toFixed(1)}%`,
    );
    console.log(
      `  🎯 Overall Score: ${(naiveMetrics.overall * 100).toFixed(1)}%`,
    );

    results.naive.push({
      query,
      time: naiveTime,
      length: naiveContext.length,
      metrics: naiveMetrics,
    });

    // Test Advanced RAG
    console.log("\n🟢 ADVANCED RAG:");
    const advancedStart = Date.now();
    const advancedContext = await advancedRAG.smartRetrieve(query);
    const advancedTime = Date.now() - advancedStart;
    const advancedMetrics = await evaluator.evaluateRetrieval(
      query,
      advancedContext,
    );

    console.log(`  ⏱️  Time: ${advancedTime}ms`);
    console.log(`  📏 Context Length: ${advancedContext.length} chars`);
    console.log(
      `  ⭐ Relevance: ${(advancedMetrics.relevance * 100).toFixed(1)}%`,
    );
    console.log(
      `  📊 Completeness: ${(advancedMetrics.completeness * 100).toFixed(1)}%`,
    );
    console.log(
      `  🎯 Overall Score: ${(advancedMetrics.overall * 100).toFixed(1)}%`,
    );

    results.advanced.push({
      query,
      time: advancedTime,
      length: advancedContext.length,
      metrics: advancedMetrics,
    });

    // Show improvement
    const timeRatio = advancedTime / naiveTime;
    const relevanceImprovement =
      ((advancedMetrics.relevance - naiveMetrics.relevance) /
        naiveMetrics.relevance) *
      100;
    const overallImprovement =
      ((advancedMetrics.overall - naiveMetrics.overall) /
        naiveMetrics.overall) *
      100;

    console.log(`\n📈 IMPROVEMENT:`);
    console.log(
      `  ⏱️  Speed: ${timeRatio > 1 ? (timeRatio - 1) * 100 : -(1 - timeRatio) * 100}% ${timeRatio > 1 ? "slower" : "faster"}`,
    );
    console.log(
      `  ⭐ Relevance: ${relevanceImprovement > 0 ? "+" : ""}${relevanceImprovement.toFixed(1)}%`,
    );
    console.log(
      `  🎯 Overall: ${overallImprovement > 0 ? "+" : ""}${overallImprovement.toFixed(1)}%`,
    );
  }

  // Calculate averages
  console.log("\n\n" + "=".repeat(80));
  console.log("📊 AGGREGATE RESULTS");
  console.log("=".repeat(80));

  const naiveAvg = calculateAverages(results.naive);
  const advancedAvg = calculateAverages(results.advanced);

  console.log("\n🔵 NAIVE RAG (Average):");
  console.log(`  ⏱️  Time: ${naiveAvg.time.toFixed(0)}ms`);
  console.log(`  📏 Context Length: ${naiveAvg.length.toFixed(0)} chars`);
  console.log(`  ⭐ Relevance: ${(naiveAvg.relevance * 100).toFixed(1)}%`);
  console.log(
    `  📊 Completeness: ${(naiveAvg.completeness * 100).toFixed(1)}%`,
  );
  console.log(`  🎯 Overall Score: ${(naiveAvg.overall * 100).toFixed(1)}%`);

  console.log("\n🟢 ADVANCED RAG (Average):");
  console.log(`  ⏱️  Time: ${advancedAvg.time.toFixed(0)}ms`);
  console.log(`  📏 Context Length: ${advancedAvg.length.toFixed(0)} chars`);
  console.log(`  ⭐ Relevance: ${(advancedAvg.relevance * 100).toFixed(1)}%`);
  console.log(
    `  📊 Completeness: ${(advancedAvg.completeness * 100).toFixed(1)}%`,
  );
  console.log(`  🎯 Overall Score: ${(advancedAvg.overall * 100).toFixed(1)}%`);

  console.log("\n📈 OVERALL IMPROVEMENT:");
  const avgTimeRatio = advancedAvg.time / naiveAvg.time;
  const avgRelevanceImprovement =
    ((advancedAvg.relevance - naiveAvg.relevance) / naiveAvg.relevance) * 100;
  const avgOverallImprovement =
    ((advancedAvg.overall - naiveAvg.overall) / naiveAvg.overall) * 100;
  const avgLengthReduction =
    ((naiveAvg.length - advancedAvg.length) / naiveAvg.length) * 100;

  console.log(
    `  ⏱️  Speed: ${avgTimeRatio > 1 ? (avgTimeRatio - 1) * 100 : -(1 - avgTimeRatio) * 100}% ${avgTimeRatio > 1 ? "slower" : "faster"}`,
  );
  console.log(
    `  ⭐ Relevance: ${avgRelevanceImprovement > 0 ? "+" : ""}${avgRelevanceImprovement.toFixed(1)}%`,
  );
  console.log(
    `  🎯 Overall: ${avgOverallImprovement > 0 ? "+" : ""}${avgOverallImprovement.toFixed(1)}%`,
  );
  console.log(
    `  📏 Context Size: ${avgLengthReduction > 0 ? "-" : "+"}${Math.abs(avgLengthReduction).toFixed(1)}%`,
  );

  console.log("\n" + "=".repeat(80));
  console.log("✅ Test Complete!");
  console.log("=".repeat(80) + "\n");

  process.exit(0);
}

function calculateAverages(results) {
  const n = results.length;
  return {
    time: results.reduce((sum, r) => sum + r.time, 0) / n,
    length: results.reduce((sum, r) => sum + r.length, 0) / n,
    relevance: results.reduce((sum, r) => sum + r.metrics.relevance, 0) / n,
    completeness:
      results.reduce((sum, r) => sum + r.metrics.completeness, 0) / n,
    overall: results.reduce((sum, r) => sum + r.metrics.overall, 0) / n,
  };
}

// Run the comparison
compareRAG().catch((error) => {
  console.error("Test error:", error);
  process.exit(1);
});
