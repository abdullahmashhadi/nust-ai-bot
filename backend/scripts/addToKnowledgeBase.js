const { VectorStore } = require('../src/services/vectoreStore');
const { QueryLogger } = require('../src/services/QueryLogger');

/**
 * Script to add timeless, positively-rated queries to the knowledge base
 * Run this periodically (e.g., weekly) to improve bot knowledge
 */
async function addQueriesToKnowledgeBase() {
  console.log('🚀 Starting knowledge base update...\n');

  try {
    // Get timeless queries with positive feedback
    const queries = await QueryLogger.getQueriesForKnowledgeBase(20);
    
    if (queries.length === 0) {
      console.log('✅ No new queries to add to knowledge base');
      return;
    }

    console.log(`📚 Found ${queries.length} queries ready to add:\n`);

    let addedCount = 0;
    let skippedCount = 0;

    for (const queryLog of queries) {
      console.log(`\n📝 Query #${queryLog.id}:`);
      console.log(`   Q: "${queryLog.query}"`);
      console.log(`   A: "${queryLog.response.substring(0, 100)}..."`);
      console.log(`   Timeless: ${queryLog.is_timeless}`);
      console.log(`   Feedback: ${queryLog.feedback}`);

      // Format as Q&A document
      const document = {
        content: `Question: ${queryLog.query}\n\nAnswer: ${queryLog.response}`,
        metadata: {
          type: 'user_query',
          source: 'feedback_system',
          verified: true,
          created_at: new Date().toISOString(),
          expires_at: queryLog.expires_at,
          original_query_id: queryLog.id,
          is_timeless: queryLog.is_timeless
        }
      };

      try {
        // Add to vector store
        const result = await VectorStore.addDocuments([document]);
        
        if (result && result.length > 0) {
          // Mark as added to KB
          await QueryLogger.markAddedToKB(queryLog.id);
          addedCount++;
          console.log(`   ✅ Added to knowledge base (Vector ID: ${result[0].id})`);
        } else {
          skippedCount++;
          console.log(`   ⚠️  Failed to add to vector store`);
        }
      } catch (error) {
        console.error(`   ❌ Error adding query ${queryLog.id}:`, error.message);
        skippedCount++;
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   ✅ Successfully added: ${addedCount}`);
    console.log(`   ⚠️  Skipped/Failed: ${skippedCount}`);
    console.log(`   📚 Total processed: ${queries.length}`);

    // Show feedback stats
    const stats = await QueryLogger.getFeedbackStats();
    if (stats) {
      console.log(`\n📈 Overall Stats:`);
      console.log(`   Total queries: ${stats.total}`);
      console.log(`   Positive feedback: ${stats.positive}`);
      console.log(`   Negative feedback: ${stats.negative}`);
      console.log(`   Timeless queries: ${stats.timeless}`);
      console.log(`   Temporal queries: ${stats.temporal}`);
    }

  } catch (error) {
    console.error('❌ Error updating knowledge base:', error);
  }
}

// Run the script
if (require.main === module) {
  addQueriesToKnowledgeBase()
    .then(() => {
      console.log('\n✅ Knowledge base update complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { addQueriesToKnowledgeBase };
