require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  try {
    console.log('📝 Reading migration file...');
    const sql = fs.readFileSync(
      path.join(__dirname, '../../supabase/migrations/20260209_query_logs.sql'),
      'utf8'
    );

    console.log('🚀 Applying migration...');
    
    // Execute SQL directly
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      const { error } = await supabase.rpc('query', { query_text: statement });
      if (error) {
        console.error('❌ Error executing statement:', error);
      }
    }

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

applyMigration();
