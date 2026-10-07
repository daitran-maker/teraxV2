const pool = require('../core/db');
const seeds = require('./seeds');
const { runSchemaV1 } = require('./schema_v1');
const { runIncrementalMigrations } = require('./incremental');

let dbInitStarted = false;
async function initDb() {
  if (dbInitStarted) return;
  dbInitStarted = true;

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('crc_helpdesk_db')) {
    console.log('Skipping database migrations for shared helpdesk DB.');
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.app_migration_meta (
        key VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── ALWAYS execute incremental migrations on startup ──
    await runIncrementalMigrations(pool, seeds);

    const checkRes = await pool.query(`SELECT 1 FROM public.app_migration_meta WHERE key = 'schema_v1_completed'`);
    if (checkRes.rows.length > 0) {
      return;
    }
  } catch (e) {
    console.warn('Migration meta check warn:', e.message);
  }

  await runSchemaV1(pool, seeds);
}

module.exports = {
  initDb,
  ensureSystemPoliciesSeed: seeds.ensureSystemPoliciesSeed
};
