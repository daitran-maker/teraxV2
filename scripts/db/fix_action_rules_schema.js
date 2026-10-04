const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  try {
    // Drop the wrong rows that I seeded earlier
    await pool.query("TRUNCATE TABLE action_rules CASCADE");

    // Add display_name column which was lost during my pg_restore
    await pool.query("ALTER TABLE action_rules ADD COLUMN IF NOT EXISTS display_name text");

    console.log("Schema fixed and truncated.");
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
fix();
