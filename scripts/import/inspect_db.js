const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tables = ['service', 'asset', 'mtr', 'service_type', 'service_status', 'asset_type', 'asset_status', 'mtr_type', 'mtr_status'];
  
  console.log('=== Checking tables in PostgreSQL ===');
  for (const table of tables) {
    try {
      const tableCheck = await pool.query(
        `SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = $1)`,
        [table]
      );
      const exists = tableCheck.rows[0].exists;
      console.log(`Table: ${table} -> Exists: ${exists}`);
      if (exists) {
        const columns = await pool.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
          [table]
        );
        console.log(`Columns for ${table}:`, columns.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
      }
    } catch (e) {
      console.error(`Error checking ${table}:`, e.message);
    }
  }
  await pool.end();
}

main().catch(console.error);
