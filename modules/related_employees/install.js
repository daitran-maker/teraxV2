/**
 * Related Employees Extension - Installer & Migration
 * 
 * Adds related_employees column and GIN index to:
 * - oppotunity
 * - contract
 * - service_delivery_contract
 * - service_task_request
 * - request
 * 
 * And backfills existing data!
 */

const { backfillTable } = require('./server/related_employees.service');

const TARGET_TABLES = [
  'oppotunity',
  'contract',
  'service_delivery_contract',
  'service_task_request',
  'request'
];

async function installRelatedEmployees(pool) {
  console.log('[related_employees] Checking database schema for related_employees extension...');

  for (const table of TARGET_TABLES) {
    try {
      // 1. Add column if not exists
      await pool.query(`
        ALTER TABLE "${table}" 
        ADD COLUMN IF NOT EXISTS "related_employees" text[] DEFAULT '{}';
      `);

      // 2. Create GIN index for blazing fast array searches (@> and &&)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS "idx_${table}_related_employees" 
        ON "${table}" USING GIN ("related_employees");
      `);
    } catch (err) {
      console.warn(`[related_employees] Migration error for table ${table}:`, err.message);
    }
  }

  // 3. Check migration meta to run initial backfill once
  try {
    const metaCheck = await pool.query(
      `SELECT 1 FROM public.app_migration_meta WHERE key = 'related_employees_v1'`
    );
    if (metaCheck.rows.length === 0) {
      console.log('[related_employees] Running initial backfill on existing records...');
      for (const table of TARGET_TABLES) {
        await backfillTable(table, pool);
      }
      await pool.query(`
        INSERT INTO public.app_migration_meta (key, applied_at)
        VALUES ('related_employees_v1', CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET applied_at = CURRENT_TIMESTAMP;
      `);
      console.log('[related_employees] Initial backfill complete and recorded in migration meta.');
    }
  } catch (metaErr) {
    console.warn('[related_employees] Meta check error:', metaErr.message);
  }

  console.log('[related_employees] Extension installation complete.');
}

if (require.main === module) {
  const pool = require('../../server/core/db');
  installRelatedEmployees(pool).then(() => {
    console.log('[related_employees] Standalone install finished.');
    process.exit(0);
  }).catch(err => {
    console.error('[related_employees] Standalone install failed:', err);
    process.exit(1);
  });
}

module.exports = installRelatedEmployees;
