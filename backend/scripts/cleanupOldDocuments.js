/**
 * Cleanup script to delete old documents with empty source_url
 * These are documents from before source tracking was implemented
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { VectorStore } = require("../src/services/vectoreStore");

async function cleanup() {
  try {
    console.log("🧹 Starting cleanup of old documents...\n");

    // Option 1: Delete documents with empty source_url
    console.log("Option 1: Delete documents with empty source_url");
    await VectorStore.deleteDocumentsWithEmptySource();

    // Option 2: Delete documents created before a specific date
    // Uncomment the lines below to delete documents before January 2026
    // console.log('\nOption 2: Delete documents before January 2026');
    // await VectorStore.deleteDocumentsBeforeDate('2026-01-01T00:00:00Z');

    console.log("\n✅ Cleanup completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  }
}

// Run cleanup
cleanup();
