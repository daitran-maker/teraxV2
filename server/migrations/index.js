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

    // ── Service Delivery Extension Installer ──
    try {
      const installServiceDelivery = require('../../modules/service_delivery/install');
      await installServiceDelivery(pool);
    } catch (extErr) {
      console.warn('[Extension] Service delivery install error:', extErr.message);
    }

    // ── Related Employees Extension Installer ──
    try {
      const installRelatedEmployees = require('../../modules/related_employees/install');
      await installRelatedEmployees(pool);
    } catch (extErr) {
      console.warn('[Extension] Related employees install error:', extErr.message);
    }

    // ── Status Catalog for Opportunity & Service Delivery ──
    try {
      const fs = require('fs');
      const path = require('path');
      const catSqlPath = path.join(__dirname, '../../migrations/2026-10-19_status_catalog_oppo_service_delivery.sql');
      if (fs.existsSync(catSqlPath)) {
        const catSql = fs.readFileSync(catSqlPath, 'utf8');
        await pool.query(catSql);
        await pool.query(`
          INSERT INTO public.app_migration_meta (key, applied_at)
          VALUES ('status_catalog_oppo_service_delivery_v1', CURRENT_TIMESTAMP)
          ON CONFLICT (key) DO UPDATE SET applied_at = CURRENT_TIMESTAMP;
        `);
      }
    } catch (catErr) {
      console.warn('[Migration] Status catalog oppo/sd install error:', catErr.message);
    }

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
