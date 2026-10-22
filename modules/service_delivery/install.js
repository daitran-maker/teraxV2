/**
 * One-Click Installer for Service Delivery Extension Module
 * Usage: node modules/service_delivery/install.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let standalonePool = null;

async function install(externalPool = null) {
  const isStandalone = !externalPool;
  const pool = externalPool || (standalonePool = standalonePool || new Pool({ connectionString: process.env.DATABASE_URL }));
  console.log('=== [Service Delivery Extension] Starting Installation ===');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Run SQL Migration
    const sqlPath = path.join(__dirname, '../../migrations/2026-10-18_service_delivery_module.sql');
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
      console.log('✓ Database schema & status catalogs created successfully.');
    }

    // 1b. Approval request link (RSDC_service_delivery) for Service Delivery Contract
    await client.query(`
      ALTER TABLE public.service_delivery_contract ADD COLUMN IF NOT EXISTS id__approval_request VARCHAR(255);
      CREATE INDEX IF NOT EXISTS idx_sd_contract_approval_request ON public.service_delivery_contract(id__approval_request);
    `);
    console.log('✓ service_delivery_contract.id__approval_request ensured.');

    // 1c. Seed action rule "Submit for approval" (only if the action framework table already exists)
    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('public.action_rules') IS NOT NULL THEN
          INSERT INTO public.action_rules (action_id, view_name, roles, description, display_name, display)
          VALUES (
            'sdc_submit', 'service_delivery_contract',
            '[request.sr_owner],[request.policy_lead],[request.requester],[request.sr_creater],[coordinator__employee],[created_by]',
            'Gửi Service Delivery Contract để phê duyệt (RSDC_service_delivery).',
            'Submit for approval', true
          )
          ON CONFLICT (action_id) DO NOTHING;
        END IF;
      END $$;
    `);

    // 2. Register migration meta
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.app_migration_meta (
        key VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      INSERT INTO public.app_migration_meta (key, applied_at)
      VALUES ('service_delivery_extension_v1', CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET applied_at = CURRENT_TIMESTAMP;
    `);
    console.log('✓ Migration metadata registered in app_migration_meta.');

    await client.query('COMMIT');
    console.log('=== [Service Delivery Extension] Installation Completed Successfully! ===\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Installation failed:', err);
    if (isStandalone) process.exit(1);
    throw err;
  } finally {
    client.release();
    if (isStandalone && standalonePool) {
      await standalonePool.end();
      standalonePool = null;
    }
  }
}

if (require.main === module) {
  install();
}

module.exports = install;
