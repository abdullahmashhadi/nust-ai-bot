require("dotenv").config();

const { VectorStore } = require("../src/services/vectoreStore.js");
const { AdvancedRAG } = require("../src/services/AdvancedRAG.js");

const vectorStore = VectorStore;
const advancedRAG = new AdvancedRAG(vectorStore);

async function compareRAG(query) {
  console.log("\n" + "=".repeat(80));
  console.log(`🔍 Query: ${query}`);
  console.log("=".repeat(80));

  // Basic RAG
  console.log("\n📌 BASIC RAG:");
  const startBasic = Date.now();
  const basicContext = await vectorStore.retrieveContext(query);
  const basicTime = Date.now() - startBasic;

  console.log(`⏱️  Time: ${basicTime}ms`);
  console.log(`📊 Context Length: ${basicContext.length} chars`);
  console.log(`📄 First 300 chars:\n${basicContext.substring(0, 300)}...`);

  // Advanced RAG
  console.log("\n🚀 ADVANCED RAG:");
  const startAdvanced = Date.now();
  const advancedContext = await advancedRAG.smartRetrieve(query);
  const advancedTime = Date.now() - startAdvanced;

  console.log(`⏱️  Time: ${advancedTime}ms`);
  console.log(`📊 Context Length: ${advancedContext.length} chars`);
  console.log(`📄 First 300 chars:\n${advancedContext.substring(0, 300)}...`);

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📈 COMPARISON:");
  console.log(
    `   Time Difference: ${advancedTime - basicTime}ms (${((advancedTime / basicTime - 1) * 100).toFixed(1)}% ${advancedTime > basicTime ? "slower" : "faster"})`,
  );
  console.log(
    `   Context Size Difference: ${advancedContext.length - basicContext.length} chars`,
  );
  console.log("=".repeat(80) + "\n");
}

// Test query
const testQuery =
  process.argv[2] || "can somone with FSc arts apply for NET engneering?";

compareRAG(testQuery)
  .then(() => {
    console.log("✅ Comparison complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
