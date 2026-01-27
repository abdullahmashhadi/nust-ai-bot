require("dotenv").config();
const { AdvancedRAG } = require("../src/services/AdvancedRAG");
const { RAGEvaluator } = require("../src/services/RAGEvaluator");

/**
 * Interactive retrieval tester
 * Run: node scripts/testQuery.js "your question here"
 */

async function testQuery() {
  const query = process.argv[2];

  if (!query) {
    console.log('Usage: node scripts/testQuery.js "your question"');
    console.log("\nExample:");
    console.log(
      '  node scripts/testQuery.js "What is NUST admission fee for BSCS?"',
    );
    process.exit(1);
  }

  console.log("\n🔍 Advanced RAG Query Test");
  console.log("=".repeat(80));
  console.log(`Query: "${query}"\n`);

  const advancedRAG = new AdvancedRAG();
  const evaluator = new RAGEvaluator();

  try {
    // Retrieve context
    console.log("⏳ Retrieving context...\n");
    const startTime = Date.now();
    const context = await advancedRAG.smartRetrieve(query);
    const retrievalTime = Date.now() - startTime;

    // Evaluate
    console.log("📊 Evaluating quality...\n");
    const metrics = await evaluator.evaluateRetrieval(query, context);

    // Display results
    console.log("=".repeat(80));
    console.log("📈 RESULTS");
    console.log("=".repeat(80));
    console.log(`\n⏱️  Retrieval Time: ${retrievalTime}ms`);
    console.log(`📏 Context Length: ${context.length} characters`);
    console.log(`📄 Context Words: ${context.split(/\s+/).length} words`);

    console.log("\n📊 Quality Metrics:");
    console.log(`  ⭐ Relevance:    ${(metrics.relevance * 100).toFixed(1)}%`);
    console.log(
      `  📋 Completeness: ${(metrics.completeness * 100).toFixed(1)}%`,
    );
    console.log(
      `  🎯 Conciseness:  ${(metrics.conciseness * 100).toFixed(1)}%`,
    );
    console.log(`  ✨ Overall:      ${(metrics.overall * 100).toFixed(1)}%`);

    // Quality assessment
    const overall = metrics.overall;
    let assessment;
    if (overall >= 0.9) assessment = "🌟 Excellent";
    else if (overall >= 0.8) assessment = "✅ Good";
    else if (overall >= 0.7) assessment = "⚠️  Fair";
    else if (overall >= 0.6) assessment = "⚡ Needs Improvement";
    else assessment = "❌ Poor";

    console.log(`\n💯 Quality Assessment: ${assessment}`);

    // Show retrieved context
    console.log("\n" + "=".repeat(80));
    console.log("📚 RETRIEVED CONTEXT");
    console.log("=".repeat(80));
    console.log(context);
    console.log("=".repeat(80));

    // Recommendations
    console.log("\n💡 RECOMMENDATIONS:");
    if (metrics.relevance < 0.7) {
      console.log(
        "  • Low relevance - consider query expansion or different keywords",
      );
    }
    if (metrics.completeness < 0.7) {
      console.log(
        "  • Incomplete - may need more documents or better chunking",
      );
    }
    if (metrics.conciseness < 0.8) {
      console.log("  • Context too verbose - increase compression target");
    }
    if (metrics.overall >= 0.85) {
      console.log("  ✨ Excellent retrieval quality - ready for production!");
    }

    console.log("\n✅ Test Complete!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testQuery();
