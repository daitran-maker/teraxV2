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

    // 1b-1. "Service contract" view = another view of the contract table (extra service columns, all nullable)
    //       + link Service Delivery Contract -> contract.
    await client.query(`
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_status INTEGER;
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_start_date DATE;
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_end_date DATE;
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_coordinator__employee VARCHAR(255);
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_contact VARCHAR(255);
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_partner VARCHAR(255);
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS sc_product VARCHAR(255);
      ALTER TABLE public.service_delivery_contract ADD COLUMN IF NOT EXISTS id__contract VARCHAR(255);
      CREATE INDEX IF NOT EXISTS idx_sdc_id__contract ON public.service_delivery_contract(id__contract);
    `);
    console.log('✓ contract.sc_* and service_delivery_contract.id__contract ensured.');

    // Generic core seams (list extension, custom cell renderer, status-card hook). Idempotent; see patch_core.js.
    try {
      require('./patch_core').patchCore();
    } catch (patchErr) {
      console.warn('! Core seams could not be applied automatically (see INSTALL.md):', patchErr.message);
    }

    // Menu entry of the Service contract view (idempotent: skipped when already present / anchor not found).
    try {
      const indexPath = path.join(__dirname, '../../public/index.html');
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf8');
        const anchor = '<a href="#service_delivery_contract"';
        if (!html.includes('id="nav-service_contract"') && html.includes(anchor)) {
          const eol = html.includes('\r\n') ? '\r\n' : '\n';
          const item = [
            '<a href="#service_contract" class="nav-item" data-module="service_contract" id="nav-service_contract" style="text-decoration:none;">',
            '          <span class="nav-icon material-symbols-rounded" id="icon-service_contract">description</span> ',
            '          <span data-i18n="nav.service_contract">Service Contracts</span>',
            '        </a>',
            '',
            '        '
          ].join(eol);
          fs.writeFileSync(indexPath, html.replace(anchor, item + anchor), 'utf8');
          console.log('✓ Service contract menu entry added to public/index.html.');
        }
      }
    } catch (navErr) {
      console.warn('! Could not add the Service contract menu entry automatically:', navErr.message);
    }

    // Task FY = year of the start date (the handler keeps it in sync); normalise existing rows (also old 'FY26' style).
    await client.query(`
      UPDATE public.service_task_request
      SET fy = to_char(started_date::date, 'YYYY')
      WHERE started_date IS NOT NULL AND fy IS DISTINCT FROM to_char(started_date::date, 'YYYY');
    `);
    console.log('✓ service_task_request.fy backfilled from started_date.');

    // 1b-2. Indexes backing the dashboard metrics (Payment ratio / Progress / Remaining time).
    //       Idempotent; an index is skipped when its table/column does not exist in this deployment.
    await client.query(`
      DO $$
      DECLARE
        spec TEXT[];
        specs TEXT[][] := ARRAY[
          ['payment', 'project'],
          ['payment', 'request'],
          ['payment', 'contract_id'],
          ['contract', 'project'],
          ['contract', 'request'],
          ['oppotunity', 'id__request'],
          ['service_delivery_contract', 'project'],
          ['service_delivery_contract', 'id__service_request'],
          ['service_task_request', 'service_delivery']
        ];
        i INT;
      BEGIN
        FOR i IN 1 .. array_length(specs, 1) LOOP
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = specs[i][1] AND column_name = specs[i][2]
          ) THEN
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
              'idx_sdm_' || specs[i][1] || '_' || specs[i][2], specs[i][1], specs[i][2]);
          END IF;
        END LOOP;
      END $$;
    `);
    console.log('✓ Dashboard metric indexes ensured.');

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
