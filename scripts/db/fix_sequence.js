const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  try {
    const q = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_class WHERE relname = 'action_rules_id_seq') THEN
          CREATE SEQUENCE action_rules_id_seq;
        END IF;
        ALTER TABLE action_rules ALTER COLUMN id SET DEFAULT nextval('action_rules_id_seq');
      END $$;
    `;
    await pool.query(q);
    console.log("Sequence fixed.");
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
fix();
