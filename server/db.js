require('dotenv').config();

const pg = require('pg');
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (val) => {
  return val ? new Date(val + 'Z') : null;
});
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (val) => {
  return val ? new Date(val) : null;
});
pg.types.setTypeParser(pg.types.builtins.DATE, (val) => val);

const { Pool } = require('pg');
const DEBUG_SQL = process.env.DEBUG_SQL === 'true';
// Chỉ bật SSL khi URL chứa 'sslmode=require' (VPS public thật sự).
// LAN, VPN (100.x.x.x), và localhost đều không dùng SSL.
const needsSSL = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 30, // Tối đa 30 kết nối đồng thời từ 1 instance Node.js
  idleTimeoutMillis: 30000, // Đóng kết nối nhàn rỗi sau 30 giây
  connectionTimeoutMillis: 10000, // Timeout nếu không kết nối được sau 10 giây
  ssl: needsSSL ? { rejectUnauthorized: false } : false
});

// Force UTC on all PostgreSQL connections
pool.on('connect', (client) => {
  client.query("SET timezone = 'UTC'").catch(() => {});
});

module.exports = pool;

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
    await runIncrementalMigrations();

    const checkRes = await pool.query(`SELECT 1 FROM public.app_migration_meta WHERE key = 'schema_v1_completed'`);
    if (checkRes.rows.length > 0) {
      return;
    }
  } catch (e) {
    console.warn('Migration meta check warn:', e.message);
  }

  pool.query(`
  DO $$
  BEGIN
    -- Drop obsolete tier approval columns from request table if they exist
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'tier_1_approval') THEN
      EXECUTE 'ALTER TABLE "request" DROP COLUMN IF EXISTS "tier_1_approval"';
      EXECUTE 'ALTER TABLE "request" DROP COLUMN IF EXISTS "tier_1_status"';
      EXECUTE 'ALTER TABLE "request" DROP COLUMN IF EXISTS "tier_1_update_date"';
      EXECUTE 'ALTER TABLE "request" DROP COLUMN IF EXISTS "tier_2_approval"';
      EXECUTE 'ALTER TABLE "request" DROP COLUMN IF EXISTS "tier_2_status"';
      EXECUTE 'ALTER TABLE "request" DROP COLUMN IF EXISTS "tier_2_update_date"';
      EXECUTE 'ALTER TABLE "request" DROP COLUMN IF EXISTS "tier_3_approval"';
      EXECUTE 'ALTER TABLE "request" DROP COLUMN IF EXISTS "tier_3_status"';
      EXECUTE 'ALTER TABLE "request" DROP COLUMN IF EXISTS "tier_3_update_date"';
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = current_schema() AND tablename = 'request_detail') THEN
      EXECUTE 'ALTER TABLE request_detail RENAME TO "comment"';
    END IF;
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'comment' AND column_name = 'to') THEN
      EXECUTE 'ALTER TABLE "comment" RENAME COLUMN "to" TO tag';
    END IF;
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'comment' AND column_name = 'request_detail_id') THEN
      EXECUTE 'ALTER TABLE "comment" RENAME COLUMN request_detail_id TO comment_id';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'comment' AND column_name = 'file') THEN
      EXECUTE 'ALTER TABLE "comment" ADD COLUMN file TEXT';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'comment' AND column_name = 'reply_to') THEN
      EXECUTE 'ALTER TABLE "comment" ADD COLUMN reply_to TEXT';
    END IF;

    -- Rename action_rules.table_name to view_name
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'action_rules' AND column_name = 'table_name') THEN
      EXECUTE 'ALTER TABLE "action_rules" RENAME COLUMN table_name TO view_name';
    END IF;

    -- Add display_name to action_rules
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'action_rules' AND column_name = 'display_name') THEN
      EXECUTE 'ALTER TABLE "action_rules" ADD COLUMN display_name TEXT';
    END IF;

    -- Add display to action_rules
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'action_rules' AND column_name = 'display') THEN
      EXECUTE 'ALTER TABLE "action_rules" ADD COLUMN display BOOLEAN DEFAULT TRUE';
    END IF;

    -- Add rating JSONB to request table
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'rating') THEN
      EXECUTE 'ALTER TABLE "request" ADD COLUMN rating JSONB';
    END IF;

    -- Create request_rating table
    EXECUTE 'CREATE TABLE IF NOT EXISTS public.request_rating (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      request_id character varying(255) NOT NULL,
      from_user character varying(255) NOT NULL,
      to_user character varying(255) NOT NULL,
      point integer NOT NULL,
      comment text,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      created_by character varying(255),
      updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      updated_by character varying(255),
      deleted_at timestamp without time zone
    )';

    -- Add elements TEXT[] to request table
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'elements') THEN
      EXECUTE 'ALTER TABLE "request" ADD COLUMN elements TEXT[]';
    ELSE
      IF (SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'elements') <> 'ARRAY' THEN
        EXECUTE 'ALTER TABLE "request" ALTER COLUMN elements TYPE TEXT[] USING string_to_array(elements, '','')';
      END IF;
    END IF;

    -- Rename sr_created_date to sr_submitted_date in request table if it exists AND sr_submitted_date does not exist
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'sr_created_date') AND NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'sr_submitted_date') THEN
      EXECUTE 'ALTER TABLE "request" RENAME COLUMN sr_created_date TO sr_submitted_date';
    END IF;

    -- Rename sr_start_date to sr_created_date in request table if it exists
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'sr_start_date') THEN
      EXECUTE 'ALTER TABLE "request" RENAME COLUMN sr_start_date TO sr_created_date';
    END IF;

    -- Alter sr_created_date to type timestamp without time zone in request table if it is not
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'sr_created_date') THEN
      IF (SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'sr_created_date') <> 'timestamp without time zone' THEN
        EXECUTE 'ALTER TABLE "request" ALTER COLUMN sr_created_date TYPE timestamp without time zone USING sr_created_date::timestamp without time zone';
      END IF;
      EXECUTE 'ALTER TABLE "request" ALTER COLUMN sr_created_date SET DEFAULT CURRENT_TIMESTAMP';
    END IF;

    -- Add invoice_request to invoice table (sub-request ID created by invoice request action)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'invoice' AND column_name = 'invoice_request') THEN
      EXECUTE 'ALTER TABLE "invoice" ADD COLUMN invoice_request TEXT';
    END IF;

    -- Add payment_request to payment table (sub-request ID created by payment request action)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'payment' AND column_name = 'payment_request') THEN
      EXECUTE 'ALTER TABLE "payment" ADD COLUMN payment_request TEXT';
    END IF;

    -- Add payment_term to payment table
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'payment' AND column_name = 'payment_term') THEN
      EXECUTE 'ALTER TABLE "payment" ADD COLUMN payment_term character varying(500)';
    END IF;

    -- Alter exchange_rate column type to numeric(20,6) in payment table
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'payment' AND column_name = 'exchange_rate') THEN
      BEGIN
        EXECUTE 'ALTER TABLE "payment" ALTER COLUMN exchange_rate TYPE numeric(20,6)';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    -- Add columns to invoice table
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'invoice' AND column_name = 'value_before_vat_in_base_currency') THEN
      EXECUTE 'ALTER TABLE "invoice" ADD COLUMN value_before_vat_in_base_currency numeric(20,6)';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'invoice' AND column_name = 'request_date') THEN
      EXECUTE 'ALTER TABLE "invoice" ADD COLUMN request_date date';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'invoice' AND column_name = 'created_by') THEN
      EXECUTE 'ALTER TABLE "invoice" ADD COLUMN created_by character varying(50)';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'invoice' AND column_name = 'created_date') THEN
      EXECUTE 'ALTER TABLE "invoice" ADD COLUMN created_date timestamp without time zone DEFAULT now()';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'invoice' AND column_name = 'updated_by') THEN
      EXECUTE 'ALTER TABLE "invoice" ADD COLUMN updated_by character varying(50)';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'invoice' AND column_name = 'updated_date') THEN
      EXECUTE 'ALTER TABLE "invoice" ADD COLUMN updated_date timestamp without time zone';
    END IF;

    -- Add amount_in_base_currency to mtr table
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'mtr' AND column_name = 'amount_in_base_currency') THEN
      EXECUTE 'ALTER TABLE "mtr" ADD COLUMN amount_in_base_currency numeric(20,6)';
    END IF;

    -- Add company_id and department_id to policy_and_program table
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'policy_and_program' AND column_name = 'company_id') THEN
      EXECUTE 'ALTER TABLE "policy_and_program" ADD COLUMN company_id TEXT DEFAULT ''1''';
    ELSE
      EXECUTE 'ALTER TABLE "policy_and_program" ALTER COLUMN company_id SET DEFAULT ''1''';
    END IF;
    UPDATE "policy_and_program" SET company_id = '1' WHERE company_id IS NULL;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'policy_and_program' AND column_name = 'department_id') THEN
      EXECUTE 'ALTER TABLE "policy_and_program" ADD COLUMN department_id TEXT';
    END IF;

    -- Add sla to policy_and_program table
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'policy_and_program' AND column_name = 'sla') THEN
      EXECUTE 'ALTER TABLE "policy_and_program" ADD COLUMN sla numeric(10,2)';
    ELSE
      BEGIN
        EXECUTE 'ALTER TABLE "policy_and_program" ALTER COLUMN sla TYPE numeric(10,2) USING sla::numeric(10,2)';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    -- Add department_code and type to department table
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'department' AND column_name = 'department_code') THEN
      IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'department' AND column_name = 'deparment_code') THEN
        EXECUTE 'ALTER TABLE "department" RENAME COLUMN deparment_code TO department_code';
      ELSE
        EXECUTE 'ALTER TABLE "department" ADD COLUMN department_code TEXT';
      END IF;
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'department' AND column_name = 'type') THEN
      EXECUTE 'ALTER TABLE "department" ADD COLUMN type TEXT';
    END IF;

    -- Add city, state, province, base_currency, and currency_list to my_company table
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'my_company' AND column_name = 'city') THEN
      EXECUTE 'ALTER TABLE "my_company" ADD COLUMN city TEXT';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'my_company' AND column_name = 'state') THEN
      EXECUTE 'ALTER TABLE "my_company" ADD COLUMN state TEXT';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'my_company' AND column_name = 'province') THEN
      EXECUTE 'ALTER TABLE "my_company" ADD COLUMN province TEXT';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'my_company' AND column_name = 'base_currency') THEN
      EXECUTE 'ALTER TABLE "my_company" ADD COLUMN base_currency TEXT';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'my_company' AND column_name = 'currency_list') THEN
      EXECUTE 'ALTER TABLE "my_company" ADD COLUMN currency_list TEXT';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'my_company' AND column_name = 'status') THEN
      EXECUTE 'ALTER TABLE "my_company" ADD COLUMN status VARCHAR(20)';
    END IF;

    -- Add notification_logs JSONB to request and parent child tables
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'notification_logs') THEN
      EXECUTE 'ALTER TABLE "request" ADD COLUMN notification_logs JSONB DEFAULT ''[]''::jsonb';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'mtr' AND column_name = 'notification_logs') THEN
      EXECUTE 'ALTER TABLE "mtr" ADD COLUMN notification_logs JSONB DEFAULT ''[]''::jsonb';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'payment' AND column_name = 'notification_logs') THEN
      EXECUTE 'ALTER TABLE "payment" ADD COLUMN notification_logs JSONB DEFAULT ''[]''::jsonb';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'service' AND column_name = 'notification_logs') THEN
      EXECUTE 'ALTER TABLE "service" ADD COLUMN notification_logs JSONB DEFAULT ''[]''::jsonb';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'contract' AND column_name = 'notification_logs') THEN
      EXECUTE 'ALTER TABLE "contract" ADD COLUMN notification_logs JSONB DEFAULT ''[]''::jsonb';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'asset' AND column_name = 'notification_logs') THEN
      EXECUTE 'ALTER TABLE "asset" ADD COLUMN notification_logs JSONB DEFAULT ''[]''::jsonb';
    END IF;
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'invoice' AND column_name = 'notification_logs') THEN
      EXECUTE 'ALTER TABLE "invoice" ADD COLUMN notification_logs JSONB DEFAULT ''[]''::jsonb';
    END IF;



    

    -- Seed Payment Request process (policy_id = '5') if not exists or ensure valid users
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = current_schema() AND tablename = 'policy_and_program') THEN
      EXECUTE '
        DO $seed$
        DECLARE
          v_emp1 TEXT;
          v_emp2 TEXT;
        BEGIN
          SELECT employee_id INTO v_emp1 FROM employee ORDER BY employee_id LIMIT 1;
          SELECT employee_id INTO v_emp2 FROM employee ORDER BY employee_id LIMIT 1 OFFSET 1;
          
          IF v_emp1 IS NULL THEN
            v_emp1 := ''EMP-001'';
          END IF;
          IF v_emp2 IS NULL THEN
            v_emp2 := v_emp1;
          END IF;

          INSERT INTO policy_and_program (
            policy_id, policy_type, policy_name, description, 
            approval_level, company_id, 
            tier1_approval, tier2_approval, policy_lead, sr_owner
          ) VALUES (
            ''5'', ''Finance'', ''Payment'', ''Yêu cầu thực hiện thanh toán'', 
            ''Tier 2'', ''1'', 
            v_emp1, v_emp2, v_emp1, v_emp1
          ) ON CONFLICT (policy_id) DO UPDATE SET
            policy_type = EXCLUDED.policy_type,
            policy_name = EXCLUDED.policy_name,
            description = EXCLUDED.description,
            approval_level = EXCLUDED.approval_level,
            company_id = EXCLUDED.company_id,
            tier1_approval = EXCLUDED.tier1_approval,
            tier2_approval = EXCLUDED.tier2_approval,
            policy_lead = EXCLUDED.policy_lead,
            sr_owner = EXCLUDED.sr_owner;

          INSERT INTO policy_and_program (
            policy_id, policy_type, policy_name, description, 
            approval_level, company_id, 
            tier1_approval, tier2_approval, policy_lead, sr_owner
          ) VALUES (
            ''RPM'', ''Finance'', ''Payment'', ''Yêu cầu thực hiện thanh toán'', 
            ''Tier 2'', ''1'', 
            v_emp1, v_emp2, v_emp1, v_emp1
          ) ON CONFLICT (policy_id) DO UPDATE SET
            policy_type = EXCLUDED.policy_type,
            policy_name = EXCLUDED.policy_name,
            description = EXCLUDED.description,
            approval_level = EXCLUDED.approval_level,
            company_id = EXCLUDED.company_id,
            tier1_approval = EXCLUDED.tier1_approval,
            tier2_approval = EXCLUDED.tier2_approval,
            policy_lead = EXCLUDED.policy_lead,
            sr_owner = EXCLUDED.sr_owner;

          INSERT INTO policy_and_program (
            policy_id, policy_type, policy_name, description, 
            approval_level, company_id, 
            tier1_approval, tier2_approval, policy_lead, sr_owner, elements
          ) VALUES (
            ''ASSIGN_TASK'', ''Workspace'', ''Assign Task'', ''Yêu cầu thực hiện giao việc (Assign Task)'', 
            ''Tier 0'', ''1'', 
            v_emp1, v_emp1, v_emp1, v_emp1, ''ASSIGN_TASK''
          ) ON CONFLICT (policy_id) DO UPDATE SET
            policy_type = EXCLUDED.policy_type,
            policy_name = EXCLUDED.policy_name,
            description = EXCLUDED.description,
            approval_level = EXCLUDED.approval_level,
            company_id = EXCLUDED.company_id,
            tier1_approval = EXCLUDED.tier1_approval,
            tier2_approval = EXCLUDED.tier2_approval,
            policy_lead = EXCLUDED.policy_lead,
            sr_owner = EXCLUDED.sr_owner,
            elements = EXCLUDED.elements;
        END $seed$;
      ';
    END IF;

    -- Backfill missing request approvals/metadata from policy for requests
    -- that don't have them set yet.
    WITH approval_backfill AS (
      SELECT
        r.request_id,
        NULLIF(p.policy_lead, '') AS resolved_policy_lead,
        NULLIF(p.sr_owner, '') AS resolved_sr_owner
      FROM "request" r
      JOIN policy_and_program p ON r.request_type = p.policy_id::text
    )
    UPDATE "request" r
    SET policy_lead = COALESCE(NULLIF(r.policy_lead, ''), b.resolved_policy_lead),
        sr_owner = COALESCE(r.sr_owner, CASE WHEN b.resolved_sr_owner IS NULL THEN NULL ELSE ARRAY[b.resolved_sr_owner] END)
    FROM approval_backfill b
    WHERE r.request_id = b.request_id
      AND (
        NULLIF(r.policy_lead, '') IS NULL
        OR r.sr_owner IS NULL
      );

    -- Migrate cms_tenant_info domain if it exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = current_schema() AND tablename = 'cms_tenant_info') THEN
      UPDATE cms_tenant_info 
      SET tenant_domain = REPLACE(tenant_domain, 'rqc.terax.ai', 'dev.terax.ai')
      WHERE tenant_domain LIKE '%rqc.terax.ai%';
    END IF;

    -- Ensure system_setup table exists before running migrations
    CREATE TABLE IF NOT EXISTS system_setup (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Migrate tier update dates to UTC
    IF NOT EXISTS (SELECT 1 FROM system_setup WHERE key = 'migration_tier_dates_utc') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'tier_1_update_date' AND data_type <> 'timestamp without time zone') THEN
        EXECUTE 'ALTER TABLE request ALTER COLUMN tier_1_update_date TYPE timestamp without time zone';
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'tier_2_update_date' AND data_type <> 'timestamp without time zone') THEN
        EXECUTE 'ALTER TABLE request ALTER COLUMN tier_2_update_date TYPE timestamp without time zone';
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request' AND column_name = 'tier_3_update_date' AND data_type <> 'timestamp without time zone') THEN
        EXECUTE 'ALTER TABLE request ALTER COLUMN tier_3_update_date TYPE timestamp without time zone';
      END IF;

      IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'tier_1_update_date') THEN
        EXECUTE 'UPDATE request SET tier_1_update_date = tier_1_update_date - INTERVAL ''7 hours'' WHERE tier_1_update_date IS NOT NULL';
        EXECUTE 'UPDATE request SET tier_2_update_date = tier_2_update_date - INTERVAL ''7 hours'' WHERE tier_2_update_date IS NOT NULL';
        EXECUTE 'UPDATE request SET tier_3_update_date = tier_3_update_date - INTERVAL ''7 hours'' WHERE tier_3_update_date IS NOT NULL';
      END IF;

      INSERT INTO system_setup (key, value, updated_at) VALUES ('migration_tier_dates_utc', 'done', CURRENT_TIMESTAMP);
    END IF;
  END $$;

  -- Dynamic check for tier columns presence
  DO $dyn_trg$
  BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'request' AND column_name = 'tier_1_status') THEN
      EXECUTE '
        CREATE OR REPLACE FUNCTION public.enforce_request_submit_status()
        RETURNS trigger AS $trg$
        BEGIN
          IF NEW.sr_status::text = ''2'' OR LOWER(COALESCE(NEW.sr_status::text, '''')) IN (''submit'', ''submitted'', ''pending approval'', ''2'') THEN
            NEW.sr_status := ''2'';
            IF NEW.sr_submitted_date IS NULL THEN
              NEW.sr_submitted_date := CURRENT_TIMESTAMP;
            END IF;
          ELSIF NEW.sr_status::text = ''1'' OR LOWER(COALESCE(NEW.sr_status::text, '''')) IN (''draft'', ''1'')
            AND LOWER(COALESCE(NEW.tier_1_status, '''')) NOT LIKE ''approved%'' THEN
            NEW.tier_1_status := ''Not started yet'';
            NEW.tier_1_update_date := NULL;
            NEW.tier_2_status := ''Not started yet'';
            NEW.tier_2_update_date := NULL;
            NEW.tier_3_status := ''Not started yet'';
            NEW.tier_3_update_date := NULL;
            NEW.process_status := ''7'';

            IF NEW.approval_flow IS NOT NULL AND jsonb_typeof(NEW.approval_flow) = ''object'' AND NEW.approval_flow ? ''steps'' THEN
              NEW.approval_flow := jsonb_set(
                NEW.approval_flow,
                ''{steps}'',
                (
                  SELECT jsonb_agg(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(step, ''{status}'', ''7''::jsonb, true),
                        ''{action_by}'', ''null''::jsonb, true
                      ),
                      ''{action_date}'', ''null''::jsonb, true
                    )
                    ORDER BY ord
                  )
                  FROM jsonb_array_elements(NEW.approval_flow->''steps'') WITH ORDINALITY AS s(step, ord)
                ),
                true
              );
            END IF;
          END IF;
          RETURN NEW;
        END;
        $trg$ LANGUAGE plpgsql;
      ';

      EXECUTE '
        UPDATE public.request
        SET tier_1_status = ''Not started yet'',
            tier_1_update_date = NULL,
            tier_2_status = ''Not started yet'',
            tier_2_update_date = NULL,
            tier_3_status = ''Not started yet'',
            tier_3_update_date = NULL,
            process_status = ''7'',
            approval_flow = CASE
              WHEN approval_flow IS NOT NULL AND jsonb_typeof(approval_flow) = ''object'' AND approval_flow ? ''steps''
              THEN jsonb_set(
                approval_flow,
                ''{steps}'',
                (
                  SELECT jsonb_agg(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(step, ''{status}'', ''7''::jsonb, true),
                        ''{action_by}'', ''null''::jsonb, true
                      ),
                      ''{action_date}'', ''null''::jsonb, true
                    )
                    ORDER BY ord
                  )
                  FROM jsonb_array_elements(approval_flow->''steps'') WITH ORDINALITY AS s(step, ord)
                ),
                true
              )
              ELSE approval_flow
            END
        WHERE sr_status::text = ''1'' OR COALESCE(sr_status::text, '''') IN (''draft'', ''1'')
          AND LOWER(COALESCE(tier_1_status, '''')) NOT LIKE ''approved%'';
      ';
    ELSE
      EXECUTE '
        CREATE OR REPLACE FUNCTION public.enforce_request_submit_status()
        RETURNS trigger AS $trg$
        BEGIN
          IF NEW.sr_status = 2 THEN
            IF NEW.sr_submitted_date IS NULL THEN
              NEW.sr_submitted_date := CURRENT_TIMESTAMP;
            END IF;

            IF NEW.approval_flow IS NOT NULL AND jsonb_typeof(NEW.approval_flow) = ''object'' AND NEW.approval_flow ? ''steps'' THEN
              NEW.approval_flow := jsonb_set(
                NEW.approval_flow,
                ''{steps}'',
                (
                  SELECT jsonb_agg(
                    CASE
                      WHEN ord = 1 AND (step->>''status'' = ''7'' OR step->>''status'' = ''1'' OR LOWER(step->>''status'') IN (''not started yet'', ''not started'', ''draft''))
                      THEN jsonb_set(step, ''{status}'', ''2''::jsonb, true)
                      ELSE step
                    END
                    ORDER BY ord
                  )
                  FROM jsonb_array_elements(NEW.approval_flow->''steps'') WITH ORDINALITY AS s(step, ord)
                ),
                true
              );
            END IF;
          ELSIF NEW.sr_status = 1 THEN
            NEW.process_status := 7;

            IF NEW.approval_flow IS NOT NULL AND jsonb_typeof(NEW.approval_flow) = ''object'' AND NEW.approval_flow ? ''steps'' THEN
              NEW.approval_flow := jsonb_set(
                NEW.approval_flow,
                ''{steps}'',
                (
                  SELECT jsonb_agg(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(step, ''{status}'', ''7''::jsonb, true),
                        ''{action_by}'', ''null''::jsonb, true
                      ),
                      ''{action_date}'', ''null''::jsonb, true
                    )
                    ORDER BY ord
                  )
                  FROM jsonb_array_elements(NEW.approval_flow->''steps'') WITH ORDINALITY AS s(step, ord)
                ),
                true
              );
            END IF;
          END IF;
          RETURN NEW;
        END;
        $trg$ LANGUAGE plpgsql;
      ';

      EXECUTE '
        UPDATE public.request
        SET process_status = 7,
            approval_flow = CASE
              WHEN approval_flow IS NOT NULL AND jsonb_typeof(approval_flow) = ''object'' AND approval_flow ? ''steps''
              THEN jsonb_set(
                approval_flow,
                ''{steps}'',
                (
                  SELECT jsonb_agg(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(step, ''{status}'', ''7''::jsonb, true),
                        ''{action_by}'', ''null''::jsonb, true
                      ),
                      ''{action_date}'', ''null''::jsonb, true
                    )
                    ORDER BY ord
                  )
                  FROM jsonb_array_elements(approval_flow->''steps'') WITH ORDINALITY AS s(step, ord)
                ),
                true
              )
              ELSE approval_flow
            END
        WHERE sr_status = 1;
      ';
    END IF;
  END $dyn_trg$;

  DROP TRIGGER IF EXISTS trg_request_submit_status ON public.request;

  CREATE TRIGGER trg_request_submit_status
  BEFORE INSERT OR UPDATE OF sr_status
  ON public.request
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_request_submit_status();

  UPDATE public.request
  SET sr_status = 2,
      sr_submitted_date = COALESCE(sr_submitted_date, CURRENT_TIMESTAMP)
  WHERE sr_status = 2 AND sr_submitted_date IS NULL;

  -- Rename sr_owner to sr_coordinator in ticket table if it exists
  DO $$
  BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'ticket' AND column_name = 'sr_owner') THEN
      ALTER TABLE "ticket" RENAME COLUMN sr_owner TO sr_coordinator;
    END IF;
  END $$;

  -- Ensure employee_code column exists in employee table
  DO $$
  BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'employee') THEN
      ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "employee_code" VARCHAR(100);
    END IF;
  END $$;

  -- Create ticket table
  CREATE TABLE IF NOT EXISTS "ticket" (
    "ticket_id" VARCHAR(50) PRIMARY KEY,
    "ticket_type" VARCHAR(100),
    "sr_creater" TEXT,
    "requester" TEXT,
    "description" TEXT,
    "tier_1_approval" TEXT,
    "tier_1_status" VARCHAR(100),
    "tier_1_update_date" TIMESTAMP,
    "tier_2_approval" TEXT,
    "tier_2_status" VARCHAR(100),
    "tier_2_update_date" TIMESTAMP,
    "tier_3_approval" TEXT,
    "tier_3_status" VARCHAR(100),
    "tier_3_update_date" TIMESTAMP,
    "sr_start_date" TIMESTAMP,
    "policy_lead" TEXT,
    "sr_coordinator" TEXT[],
    "sr_status" INTEGER DEFAULT 10,
    "sr_created_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "sr_close_date" TIMESTAMP,
    "process_status" INTEGER DEFAULT 14,
    "process_start_date" TIMESTAMP,
    "process_end_date" TIMESTAMP,
    "approval_level" TEXT,
    "created_by" VARCHAR(50),
    "created_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_by" VARCHAR(50),
    "updated_date" TIMESTAMP,
    "log" JSONB DEFAULT '[]'::jsonb,
    "rating" JSONB,
    "approval_flow" JSONB,
    "subdomain" TEXT,
    "deleted_at" TIMESTAMP
  );

  -- Create ticket_comment table
  CREATE TABLE IF NOT EXISTS "ticket_comment" (
    "comment_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ticket" TEXT,
    "comment" TEXT,
    "file" TEXT,
    "link" TEXT,
    "comment_by" TEXT,
    "comment_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "reply_to" TEXT,
    "tag" TEXT,
    "created_by" VARCHAR(50),
    "created_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_by" VARCHAR(50),
    "updated_date" TIMESTAMP,
    "deleted_at" TIMESTAMP
  );

  -- Create my_location table
  CREATE TABLE IF NOT EXISTS "my_location" (
    "my_location_id" TEXT PRIMARY KEY,
    "location_code" TEXT,
    "type" TEXT,
    "address" TEXT,
    "my_company" TEXT,
    "responsible_employee" TEXT,
    "status" TEXT,
    "created_by" TEXT,
    "created_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "updated_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "log" JSONB DEFAULT '[]'::jsonb
  );

  -- Create push_subscriptions table
  CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "user_employee_id" TEXT,
    "endpoint" TEXT PRIMARY KEY,
    "p256dh" TEXT,
    "auth" TEXT,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Create notification table
  CREATE TABLE IF NOT EXISTS "notification" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_employee_id" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255),
    "body" TEXT,
    "link" VARCHAR(512),
    "is_read" BOOLEAN DEFAULT FALSE,
    "created_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Drop deprecated finance_logs table if exists
  DROP TABLE IF EXISTS public.finance_logs CASCADE;

  -- Create or replace v_finance view grouped by Process (direct aggregation)
  DO $$
  BEGIN
    EXECUTE 'DROP VIEW IF EXISTS public.v_finance CASCADE';
    EXECUTE $sub$
      CREATE OR REPLACE VIEW public.v_finance AS
      WITH contract_agg AS (
        SELECT 
          COALESCE(c.request, c.id__request) AS request_id,
          COUNT(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' THEN 1 END) AS selling_contract_count,
          SUM(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' 
              THEN COALESCE(c.total_value_in_base_currency, c.total_value * COALESCE(c.exchance_rate, 1.0), COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) + COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0)) 
              ELSE 0 END) AS selling,
          SUM(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' 
              THEN COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0) 
              ELSE 0 END) AS vat_selling,
          SUM(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' 
              THEN COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) 
              ELSE 0 END) AS selling_wo_vat,
          COUNT(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' THEN 1 END) AS buying_contract_count,
          SUM(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' 
              THEN COALESCE(c.total_value_in_base_currency, c.total_value * COALESCE(c.exchance_rate, 1.0), COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) + COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0)) 
              ELSE 0 END) AS buying,
          SUM(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' 
              THEN COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0) 
              ELSE 0 END) AS vat_buying,
          SUM(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' 
              THEN COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) 
              ELSE 0 END) AS buying_wo_vat
        FROM contract c
        WHERE c.deleted_at IS NULL AND COALESCE(c.request, c.id__request) IS NOT NULL
        GROUP BY COALESCE(c.request, c.id__request)
      ),
      payment_agg AS (
        SELECT
          COALESCE(p.request, c.request, c.id__request) AS request_id,
          COUNT(CASE WHEN (c.type = 69 OR p.payment_type = 60) THEN 1 END) AS incoming_pm_count,
          SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_payment,
          SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) AND (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_payment_paid,
          SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NOT NULL AND p.due_date::date > CURRENT_DATE) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_pm_not_due_yet,
          SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NULL OR p.due_date::date <= CURRENT_DATE) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_pm_pending_pm,
          COUNT(CASE WHEN (c.type = 70 OR p.payment_type = 61) THEN 1 END) AS outgoing_pm_count,
          SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_payment,
          SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) AND (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_payment_paid,
          SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NOT NULL AND p.due_date::date > CURRENT_DATE) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_pm_not_due_yet,
          SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NULL OR p.due_date::date <= CURRENT_DATE) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_pm_pending_pm
        FROM payment p
        LEFT JOIN contract c ON p.contract_id = c.contract_id AND c.deleted_at IS NULL
        WHERE p.deleted_at IS NULL AND COALESCE(p.request, c.request, c.id__request) IS NOT NULL
        GROUP BY COALESCE(p.request, c.request, c.id__request)
      ),
      invoice_agg AS (
        SELECT
          COALESCE(i.request, c.request, c.id__request) AS request_id,
          COUNT(CASE WHEN (c.type = 69 OR i.invoice_type = '71' OR LOWER(i.invoice_type::text) = 'selling') THEN 1 END) AS selling_invoice_count,
          SUM(CASE WHEN (c.type = 69 OR i.invoice_type = '71' OR LOWER(i.invoice_type::text) = 'selling') 
              THEN COALESCE(i.total_value_in_base_currency, i.total_value * COALESCE(i.exchange_rate, 1.0), 0) ELSE 0 END) AS selling_invoice_total_value,
          COUNT(CASE WHEN NOT (c.type = 69 OR i.invoice_type = '71' OR LOWER(i.invoice_type::text) = 'selling') THEN 1 END) AS buying_invoice_count,
          SUM(CASE WHEN NOT (c.type = 69 OR i.invoice_type = '71' OR LOWER(i.invoice_type::text) = 'selling') 
              THEN COALESCE(i.total_value_in_base_currency, i.total_value * COALESCE(i.exchange_rate, 1.0), 0) ELSE 0 END) AS buying_invoice_total_value
        FROM invoice i
        LEFT JOIN contract c ON i.contract_id = c.contract_id AND c.deleted_at IS NULL
        WHERE i.deleted_at IS NULL AND COALESCE(i.request, c.request, c.id__request) IS NOT NULL
        GROUP BY COALESCE(i.request, c.request, c.id__request)
      ),
      expense_agg AS (
        SELECT
          e.id__request AS request_id,
          SUM(CASE WHEN e.id__expense_type = 107 OR LOWER(e.id__expense_type::text) = 'non expense' 
              THEN 0 
              ELSE COALESCE(e.total_value_in_base_currency, e.total_value * COALESCE(e.exchange_rate, 1.0), COALESCE(e.value_before_vat, 0) * COALESCE(e.exchange_rate, 1.0), 0) END) AS expense,
          SUM(CASE WHEN e.id__expense_type = 107 OR LOWER(e.id__expense_type::text) = 'non expense' 
              THEN COALESCE(e.total_value_in_base_currency, e.total_value * COALESCE(e.exchange_rate, 1.0), COALESCE(e.value_before_vat, 0) * COALESCE(e.exchange_rate, 1.0), 0) 
              ELSE 0 END) AS non_expense,
          MAX(e.fy) AS exp_fy
        FROM expense e
        WHERE e.deleted_at IS NULL AND e.id__request IS NOT NULL
        GROUP BY e.id__request
      ),
      asset_agg AS (
        SELECT
          a.request AS request_id,
          SUM(COALESCE(
            a.value_in_base_currency,
            COALESCE(NULLIF(regexp_replace(a.purchase_cost, '[^0-9.]', '', 'g'), '')::numeric, 0) * COALESCE(NULLIF(regexp_replace(a.exchange_rate, '[^0-9.]', '', 'g'), '')::numeric, 1.0)
          )) AS asset
        FROM asset a
        WHERE a.deleted_at IS NULL AND a.request IS NOT NULL
        GROUP BY a.request
      ),
      request_financials AS (
        SELECT 
          r.request_id,
          r.request_type,
          (CASE 
            WHEN ea.exp_fy IS NOT NULL AND ea.exp_fy <> '' THEN 
              (CASE WHEN ea.exp_fy LIKE 'FY%' THEN ea.exp_fy ELSE 'FY' || ea.exp_fy END)
            ELSE 'FY' || EXTRACT(YEAR FROM COALESCE(r.sr_submitted_date, r.sr_created_date, CURRENT_TIMESTAMP))::text 
          END) AS fy,
          COALESCE(ca.selling_contract_count, 0) AS selling_contract_count,
          COALESCE(ca.selling, 0) AS selling,
          COALESCE(ca.vat_selling, 0) AS vat_selling,
          COALESCE(ca.selling_wo_vat, 0) AS selling_wo_vat,
          COALESCE(ca.buying_contract_count, 0) AS buying_contract_count,
          COALESCE(ca.buying, 0) AS buying,
          COALESCE(ca.vat_buying, 0) AS vat_buying,
          COALESCE(ca.buying_wo_vat, 0) AS buying_wo_vat,
          COALESCE(pa.incoming_pm_count, 0) AS incoming_pm_count,
          COALESCE(pa.incoming_payment, 0) AS incoming_payment,
          COALESCE(pa.incoming_payment_paid, 0) AS incoming_payment_paid,
          COALESCE(pa.incoming_pm_not_due_yet, 0) AS incoming_pm_not_due_yet,
          COALESCE(pa.incoming_pm_pending_pm, 0) AS incoming_pm_pending_pm,
          COALESCE(pa.outgoing_pm_count, 0) AS outgoing_pm_count,
          COALESCE(pa.outgoing_payment, 0) AS outgoing_payment,
          COALESCE(pa.outgoing_payment_paid, 0) AS outgoing_payment_paid,
          COALESCE(pa.outgoing_pm_not_due_yet, 0) AS outgoing_pm_not_due_yet,
          COALESCE(pa.outgoing_pm_pending_pm, 0) AS outgoing_pm_pending_pm,
          COALESCE(ia.selling_invoice_count, 0) AS selling_invoice_count,
          COALESCE(ia.selling_invoice_total_value, 0) AS selling_invoice_total_value,
          COALESCE(ia.buying_invoice_count, 0) AS buying_invoice_count,
          COALESCE(ia.buying_invoice_total_value, 0) AS buying_invoice_total_value,
          COALESCE(ea.expense, 0) AS expense,
          COALESCE(ea.non_expense, 0) AS non_expense,
          COALESCE(aa.asset, 0) AS asset
        FROM request r
        LEFT JOIN contract_agg ca ON r.request_id = ca.request_id
        LEFT JOIN payment_agg pa ON r.request_id = pa.request_id
        LEFT JOIN invoice_agg ia ON r.request_id = ia.request_id
        LEFT JOIN expense_agg ea ON r.request_id = ea.request_id
        LEFT JOIN asset_agg aa ON r.request_id = aa.request_id
        WHERE r.deleted_at IS NULL
      ),
      process_summary AS (
        SELECT
          rf.request_type AS process_id,
          rf.fy,
          COUNT(rf.request_id) AS total_requests,
          SUM(rf.selling_contract_count) AS selling_contract_count,
          SUM(rf.selling) AS selling,
          SUM(rf.vat_selling) AS vat_selling,
          SUM(rf.selling_wo_vat) AS selling_wo_vat,
          SUM(rf.buying_contract_count) AS buying_contract_count,
          SUM(rf.buying) AS buying,
          SUM(rf.vat_buying) AS vat_buying,
          SUM(rf.buying_wo_vat) AS buying_wo_vat,
          (SUM(rf.selling) - SUM(rf.buying)) AS gm,
          (SUM(rf.selling_wo_vat) - SUM(rf.buying_wo_vat)) AS gm_wo_vat,
          SUM(rf.incoming_pm_count) AS incoming_pm_count,
          SUM(rf.incoming_payment) AS incoming_payment,
          SUM(rf.incoming_payment_paid) AS incoming_payment_paid,
          SUM(rf.incoming_pm_not_due_yet) AS incoming_pm_not_due_yet,
          SUM(rf.incoming_pm_pending_pm) AS incoming_pm_pending_pm,
          SUM(rf.outgoing_pm_count) AS outgoing_pm_count,
          SUM(rf.outgoing_payment) AS outgoing_payment,
          SUM(rf.outgoing_payment_paid) AS outgoing_payment_paid,
          SUM(rf.outgoing_pm_not_due_yet) AS outgoing_pm_not_due_yet,
          SUM(rf.outgoing_pm_pending_pm) AS outgoing_pm_pending_pm,
          SUM(rf.selling_invoice_count) AS selling_invoice_count,
          SUM(rf.selling_invoice_total_value) AS selling_invoice_total_value,
          SUM(rf.buying_invoice_count) AS buying_invoice_count,
          SUM(rf.buying_invoice_total_value) AS buying_invoice_total_value,
          SUM(rf.expense) AS expense,
          SUM(rf.non_expense) AS non_expense,
          SUM(rf.asset) AS asset
        FROM request_financials rf
        WHERE (
          rf.selling <> 0 OR rf.buying <> 0 OR rf.incoming_payment <> 0 OR 
          rf.outgoing_payment <> 0 OR rf.expense <> 0 OR rf.non_expense <> 0 OR rf.asset <> 0
        )
        GROUP BY rf.request_type, rf.fy
      )
      SELECT 
        (p.policy_id || '__' || COALESCE(ps.fy, 'N/A')) AS id,
        p.policy_id AS process_id,
        p.policy_name AS process,
        p.policy_type,
        p.description,
        p.policy_lead,
        COALESCE(mc.country, '') AS country,
        p.company_id,
        COALESCE(ps.fy, '') AS fy,
        COALESCE(ps.selling_contract_count, 0) AS selling_contract_count,
        COALESCE(ps.selling, 0) AS selling,
        COALESCE(ps.buying_contract_count, 0) AS buying_contract_count,
        COALESCE(ps.buying, 0) AS buying,
        COALESCE(ps.gm, 0) AS gm,
        COALESCE(ps.vat_selling, 0) AS vat_selling,
        COALESCE(ps.selling_wo_vat, 0) AS selling_wo_vat,
        COALESCE(ps.vat_buying, 0) AS vat_buying,
        COALESCE(ps.buying_wo_vat, 0) AS buying_wo_vat,
        COALESCE(ps.gm_wo_vat, 0) AS gm_wo_vat,
        COALESCE(ps.incoming_pm_count, 0) AS incoming_pm_count,
        COALESCE(ps.incoming_payment, 0) AS incoming_payment,
        COALESCE(ps.incoming_payment_paid, 0) AS incoming_payment_paid,
        COALESCE(ps.incoming_pm_not_due_yet, 0) AS incoming_pm_not_due_yet,
        COALESCE(ps.incoming_pm_pending_pm, 0) AS incoming_pm_pending_pm,
        COALESCE(ps.outgoing_pm_count, 0) AS outgoing_pm_count,
        COALESCE(ps.outgoing_payment, 0) AS outgoing_payment,
        COALESCE(ps.outgoing_payment_paid, 0) AS outgoing_payment_paid,
        COALESCE(ps.outgoing_pm_not_due_yet, 0) AS outgoing_pm_not_due_yet,
        COALESCE(ps.outgoing_pm_pending_pm, 0) AS outgoing_pm_pending_pm,
        COALESCE(ps.selling_invoice_count, 0) AS selling_invoice_count,
        COALESCE(ps.selling_invoice_total_value, 0) AS selling_invoice_total_value,
        COALESCE(ps.buying_invoice_count, 0) AS buying_invoice_count,
        COALESCE(ps.buying_invoice_total_value, 0) AS buying_invoice_total_value,
        COALESCE(ps.expense, 0) AS expense,
        COALESCE(ps.non_expense, 0) AS non_expense,
        COALESCE(ps.asset, 0) AS asset,
        COALESCE(ps.total_requests, 0) AS total_requests
      FROM policy_and_program p
      LEFT JOIN my_company mc ON p.company_id = mc.my_company_id
      JOIN process_summary ps ON p.policy_id::text = ps.process_id::text OR p.policy_name = ps.process_id::text
      WHERE p.deleted_at IS NULL;
    $sub$;
  END $$;

  -- Create or replace v_department view
  DO $$
  BEGIN
    EXECUTE 'DROP VIEW IF EXISTS public.v_department_select CASCADE';
    EXECUTE 'DROP VIEW IF EXISTS public.v_department CASCADE';

    EXECUTE 'CREATE VIEW public.v_department AS
      SELECT
        d.department_id,
        d.department_name,
        d.department_code,
        d.type,
        d.manager_email,
        d.company_id,
        d.log,
        d.deleted_at,
        c.company_shortname,
        CONCAT(
          d.department_name,
          '' | '',
          c.company_shortname
        ) AS department_label
      FROM public.department d
      LEFT JOIN public.my_company c
        ON c.my_company_id::text = d.company_id::text';

    -- Backfill default department type if null
    UPDATE public.department SET type = 'Operation' WHERE type IS NULL AND (department_name ILIKE '%OPERATION%' OR department_name ILIKE '%BOARD%');
    UPDATE public.department SET type = 'Sale and MKT' WHERE type IS NULL AND (department_name ILIKE '%SALE%' OR department_name ILIKE '%MKT%' OR department_name ILIKE '%MARKETING%');
    UPDATE public.department SET type = 'Finance' WHERE type IS NULL AND (department_name ILIKE '%FINANCE%' OR department_name ILIKE '%ACCOUNT%');
    UPDATE public.department SET type = 'Technical' WHERE type IS NULL AND (department_name ILIKE '%TECH%' OR department_name ILIKE '%DEV%' OR department_name ILIKE '%APP%' OR department_name ILIKE '%AI%');
    UPDATE public.department SET type = 'Operation' WHERE type IS NULL;

    -- Backfill default invoice_type if null
    UPDATE public.invoice SET invoice_type = 'Selling' WHERE invoice_type IS NULL OR invoice_type = '';
  END $$;

  -- Migrate action_rules constraint to UNIQUE (action_id)
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'action_rules_action_id_view_name_key'
    ) THEN
      EXECUTE 'ALTER TABLE action_rules DROP CONSTRAINT action_rules_action_id_view_name_key';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'action_rules_action_id_key'
    ) THEN
      -- Clean up any duplicates before adding unique constraint, keeping the older one (smaller id)
      DELETE FROM action_rules a
      USING action_rules b
      WHERE a.action_id = b.action_id AND a.id > b.id;

      EXECUTE 'ALTER TABLE action_rules ADD CONSTRAINT action_rules_action_id_key UNIQUE (action_id)';
    END IF;

    -- Add unique constraint for column_permissions (table_name, column_name)
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'column_permissions_table_column_key'
    ) THEN
      EXECUTE 'ALTER TABLE column_permissions ADD CONSTRAINT column_permissions_table_column_key UNIQUE (table_name, column_name)';
    END IF;
  END $$;

  -- Clean up duplicate bracketed entries if any exist
  DELETE FROM action_rules a
  USING action_rules b
  WHERE a.id <> b.id
    AND a.action_id = b.action_id
    AND REPLACE(REPLACE(a.view_name, '[', ''), ']', '') = REPLACE(REPLACE(b.view_name, '[', ''), ']', '')
    AND (a.view_name LIKE '%[%' OR a.view_name LIKE '%]%')
    AND (b.view_name NOT LIKE '%[%' AND b.view_name NOT LIKE '%]%');

  UPDATE action_rules
  SET view_name = REPLACE(REPLACE(view_name, '[', ''), ']', '')
  WHERE view_name LIKE '%[%' OR view_name LIKE '%]%';

  -- Seed workflow and custom actions
  INSERT INTO action_rules (action_id, view_name, roles, display_name, description)
  VALUES
    ('change_sr_owner', 'my_team', '[POLICY LEAD]', 'Change SR Owner', 'Cho phép Policy Lead / Super Admin gán/thay đổi người sở hữu yêu cầu. Điều kiện hiển thị: Status khác Closed, Cancelled VÀ Người dùng là Policy Lead của yêu cầu / Super Admin.'),
    ('ACT-REQUEST-02', 'my_process_owner,my_task,my_team', '[POLICY LEAD],[sr_owner]', 'Elements', 'Cập nhật các thành phần liên kết của yêu cầu. Điều kiện hiển thị: Status khác ''Draft'' VÀ Process Status = ''Processing'' hoặc ''Completed''.'),
    ('ACT-REQUEST-03', 'my_request,my_approval,my_process_owner,my_task,my_team', '[sr_creater],[requester]', 'FeedBack', 'Đánh giá yêu cầu đã hoàn thành. Điều kiện hiển thị: Process Status = ''Completed'' VÀ Rating chưa được thiết lập (NULL).'),
    ('ACT-REQUEST-03-RE', 'my_request,my_approval,my_process_owner,my_task,my_team', '[sr_creater],[requester]', 'FeedBack again', 'Thay đổi đánh giá của yêu cầu. Điều kiện hiển thị: Process Status = ''Completed'' VÀ Rating đã được thiết lập VÀ Status = Closed.'),
    ('ACT-SUPPORT-03', 'support', '[sr_creater],[requester]', 'Rating', 'Đánh giá ticket đã hoàn thành. Điều kiện hiển thị: Process Status = ''Completed'' VÀ Rating chưa được thiết lập (NULL) VÀ Status khác Closed.'),
    ('ACT-SUPPORT-03-RE', 'support', '[sr_creater],[requester]', 'Rate again', 'Thay đổi đánh giá của ticket. Điều kiện hiển thị: Process Status = ''Completed'' VÀ Rating đã được thiết lập VÀ Status = Closed.'),
    ('ACT-REQUEST-04', 'my_process_owner,my_task,my_team', '[POLICY LEAD]', 'Re-update Process Status', 'Sửa đổi trạng thái xử lý của yêu cầu. Điều kiện hiển thị: Status = ''Approved'' VÀ Process Status = ''Completed''.'),
    ('ACT-REQUEST-05', 'my_process_owner,my_task,my_team', '[POLICY LEAD],[sr_owner]', 'Cancel', 'Hủy bỏ yêu cầu. Điều kiện hiển thị: Status = ''Approved'' VÀ Process Status = ''Processing'' hoặc ''Not started yet''.'),
    ('ACT-REQUEST-06', 'my_request', '[sr_creater],[requester]', 'Close', 'Đóng yêu cầu sau khi xử lý xong. Điều kiện hiển thị: Status = ''Approved'' VÀ Process Status = ''Completed''.'),
    ('ACT-REQUEST-07', 'my_process_owner,my_task,my_team', '[POLICY LEAD],[sr_owner]', 'Complete', 'Đánh dấu yêu cầu đã hoàn thành xử lý. Điều kiện hiển thị: Status = ''Approved'' VÀ Process Status = ''Processing''.'),
    ('ACT-REQUEST-08', 'my_process_owner,my_task,my_team', '[POLICY LEAD],[sr_owner]', 'Start', 'Bắt đầu xử lý yêu cầu. Điều kiện hiển thị: Status = ''Approved'' VÀ Process Status = ''Not started yet''.'),
    ('ACT-REQUEST-09', 'my_request', '[sr_creater],[requester]', 'Submit', 'Gửi yêu cầu đi phê duyệt. Điều kiện hiển thị: Status = ''Draft'' hoặc ''Rejected''.'),
    ('withdraw_request', 'my_request', '[sr_creater],[requester]', 'Withdraw', 'Rút lại yêu cầu đã gửi. Điều kiện hiển thị: Status khác Draft.'),
    ('approve_request', 'my_approval', '[tier_1_approval],[tier_2_approval],[tier_3_approval]', 'Approve', 'Phê duyệt yêu cầu. Điều kiện hiển thị: Status = ''Pending Approval'' VÀ Người dùng là người phê duyệt của cấp hiện tại / Super Admin.'),
    ('reject_request', 'my_approval', '[tier_1_approval],[tier_2_approval],[tier_3_approval]', 'Reject', 'Từ chối yêu cầu. Điều kiện hiển thị: Status = ''Pending Approval'' VÀ Người dùng là người phê duyệt của cấp hiện tại / Super Admin.'),
    ('payment_req_outgoing', 'payment', '[request.sr_owner],[request.policy_lead],[request.requester],[request.sr_creater]', 'Request payment', 'Yêu cầu thanh toán cho khoản chi đi. Điều kiện hiển thị: Payment Type = ''Outgoing'' VÀ Payment Status thuộc (''Draft'', ''Not due yet'', ''Overdue'').'),
    ('payment_req_incoming_collection', 'payment', '[request.sr_owner],[request.policy_lead],[request.requester],[request.sr_creater]', 'Request collection', 'Yêu cầu thu nợ cho khoản thu vào. Điều kiện hiển thị: Payment Type = ''Incoming'' VÀ Payment Status = ''Pending payment''.'),
    ('payment_req_incoming_status', 'payment', '[request.sr_owner],[request.policy_lead],[request.requester],[request.sr_creater]', 'Request payment status', 'Yêu cầu kiểm tra trạng thái thanh toán. Điều kiện hiển thị: Payment Type = ''Incoming'' VÀ Payment Status thuộc (''Draft'', ''Not due yet'', ''Pending payment'', ''Collection working'').'),
    ('payment_paid', 'payment', '[request.sr_owner],[request.policy_lead]', 'Paid', 'Đánh dấu đã thanh toán. Điều kiện hiển thị: Payment Status khác ''Paid''.'),
    ('payment_ready', 'payment', '[request.sr_owner],[request.policy_lead],[request.requester],[request.sr_creater]', 'Ready for Payment', 'Sẵn sàng thanh toán (Luôn hiển thị).'),
    ('payment_update_transaction', 'payment', '[request.sr_owner],[request.policy_lead],[request.requester],[request.sr_creater]', 'Update Transaction', 'Cập nhật thông tin giao dịch. Điều kiện hiển thị: Payment Status = ''Paid'' VÀ chưa có Transaction ID.'),
    ('payment_change_mtr', 'payment', '[request.sr_owner],[request.policy_lead]', 'Change MTR', 'Thay đổi MTR transaction cho payment đã thanh toán. Điều kiện hiển thị: Payment Status = ''Paid'' VÀ đã có Transaction ID.'),
    ('ACT-REQUEST-016', 'my_request,my_process_owner,my_task,my_team,my_approval,request', '[sr_creater],[requester],[sr_owner],[policy_lead]', 'View Main Request', 'Chuyển hướng xem chi tiết yêu cầu gốc. Điều kiện hiển thị: Request ID có chứa ký tự ''-'' VÀ có ít nhất 1 liên kết payment hoặc invoice.')
  ON CONFLICT (action_id) DO NOTHING;

  -- Ensure ACT-REQUEST-016 exists in action_rules
  INSERT INTO action_rules (action_id, view_name, roles, display_name, description)
  VALUES ('ACT-REQUEST-016', 'my_request,my_process_owner,my_task,my_team,my_approval,request', '[sr_creater],[requester],[sr_owner],[policy_lead]', 'View Main Request', 'Chuyển hướng xem chi tiết yêu cầu gốc. Điều kiện hiển thị: Request ID có chứa ký tự ''-'' VÀ có ít nhất 1 liên kết payment hoặc invoice.')
  ON CONFLICT (action_id) DO UPDATE SET
    view_name = EXCLUDED.view_name,
    roles = EXCLUDED.roles,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

  -- Ensure existing payment rules get updated descriptions
  UPDATE action_rules 
  SET description = 'Yêu cầu thanh toán cho khoản chi đi. Điều kiện hiển thị: Payment Type = ''Outgoing'' VÀ Payment Status thuộc (''Draft'', ''Not due yet'', ''Overdue'').' 
  WHERE action_id = 'payment_req_outgoing';

  UPDATE action_rules 
  SET description = 'Cập nhật thông tin giao dịch. Điều kiện hiển thị: Payment Status = ''Paid'' VÀ chưa có Transaction ID.' 
  WHERE action_id = 'payment_update_transaction';

  UPDATE action_rules 
  SET description = 'Thay đổi MTR transaction cho payment đã thanh toán. Điều kiện hiển thị: Payment Status = ''Paid'' VÀ đã có Transaction ID.' 
  WHERE action_id = 'payment_change_mtr';

  UPDATE action_rules
  SET description = 'Rút lại yêu cầu đã gửi. Điều kiện hiển thị: Status = ''Pending Approval'' hoặc ''Submitted'', HOẶC Process Status = ''Canceled''.'
  WHERE action_id = 'withdraw_request';

  UPDATE action_rules
  SET description = 'Cho phép Policy Lead / Super Admin gán/thay đổi người sở hữu yêu cầu. Điều kiện hiển thị: Status khác Closed VÀ Người dùng là Policy Lead của yêu cầu / Super Admin.'
  WHERE action_id = 'change_sr_owner';

  UPDATE action_rules
  SET view_name = 'my_process_owner,my_task,my_team'
  WHERE action_id = 'ACT-REQUEST-02';

  UPDATE action_rules
  SET view_name = 'my_request,my_approval,my_process_owner,my_task,my_team'
  WHERE action_id IN ('ACT-REQUEST-03', 'ACT-REQUEST-03-RE');

  -- Migrate old generic add/edit/delete action_ids to add_viewname/edit_viewname/delete_viewname format
  -- Only rename rows where action_id is exactly 'add', 'edit', 'delete' (no underscore suffix yet)
  UPDATE action_rules
    SET action_id = action_id || '_' || view_name
    WHERE action_id IN ('add', 'edit', 'delete')
      AND view_name IS NOT NULL
      AND view_name <> ''
      AND view_name <> '*';

  -- Clean up leftover old global rules with empty or '*' view_name
  DELETE FROM action_rules WHERE action_id IN ('add', 'edit', 'delete') AND (view_name = '' OR view_name IS NULL OR view_name = '*');

  -- Update roles from '[]' to NULL for all action rules
  UPDATE action_rules SET roles = NULL WHERE roles = '[]' OR roles = '';

  -- Migrate child table action rules to have view_name = 'request'
  DELETE FROM action_rules 
  WHERE action_id IN (
    'add_payment', 'edit_payment', 'delete_payment',
    'add_service', 'edit_service', 'delete_service',
    'add_asset', 'edit_asset', 'delete_asset',
    'add_mtr', 'edit_mtr', 'delete_mtr',
    'add_invoice', 'edit_invoice', 'delete_invoice',
    'add_assigned_task', 'edit_assigned_task', 'delete_assigned_task',
    'add_contract', 'edit_contract', 'delete_contract'
  ) AND view_name = 'request'
    AND EXISTS (
      SELECT 1 FROM action_rules ar 
      WHERE ar.action_id = action_rules.action_id 
        AND ar.view_name IN ('payment', 'service', 'asset', 'mtr', 'invoice', 'assigned_task', 'contract')
    );

  UPDATE action_rules
  SET view_name = 'request'
  WHERE action_id IN (
    'add_payment', 'edit_payment', 'delete_payment',
    'add_service', 'edit_service', 'delete_service',
    'add_asset', 'edit_asset', 'delete_asset',
    'add_mtr', 'edit_mtr', 'delete_mtr',
    'add_invoice', 'edit_invoice', 'delete_invoice',
    'add_assigned_task', 'edit_assigned_task', 'delete_assigned_task',
    'add_contract', 'edit_contract', 'delete_contract'
  ) AND view_name IN ('payment', 'service', 'asset', 'mtr', 'invoice', 'assigned_task', 'contract');

  DELETE FROM action_rules WHERE action_id IN ('edit_support', 'delete_support', 'ACT-SUPPORT-03', 'ACT-SUPPORT-03-RE');

  -- Seed specific table rules so they are individually configurable (new add_viewname format)
  INSERT INTO action_rules (action_id, view_name, roles, display_name, description)
  VALUES
    ('add_employee', 'employee', NULL, 'Add Employee', 'Add new employee records'),
    ('edit_employee', 'employee', NULL, 'Edit Employee', 'Edit employee records'),
    ('delete_employee', 'employee', NULL, 'Delete Employee', 'Delete employee records'),

    ('add_employee_active', 'employee_active', NULL, 'Add Active Employee', 'Add active employee records'),
    ('edit_employee_active', 'employee_active', NULL, 'Edit Active Employee', 'Edit employee records'),
    ('delete_employee_active', 'employee_active', NULL, 'Delete Active Employee', 'Delete active employee records'),

    ('add_payment', 'request', NULL, 'Add Payment', 'Add new payment records'),
    ('edit_payment', 'request', NULL, 'Edit Payment', 'Edit payment records'),
    ('delete_payment', 'request', NULL, 'Delete Payment', 'Delete payment records'),

    ('add_contract', 'request', NULL, 'Add Contract', 'Add new contract records'),
    ('edit_contract', 'request', NULL, 'Edit Contract', 'Edit contract records'),
    ('delete_contract', 'request', NULL, 'Delete Contract', 'Delete contract records'),

    ('add_expense', 'request', NULL, 'Add Expense', 'Add new expense records'),
    ('edit_expense', 'request', NULL, 'Edit Expense', 'Edit expense records'),
    ('delete_expense', 'request', NULL, 'Delete Expense', 'Delete expense records'),

    -- add/edit/delete for request table with correct views & roles per Excel spec
    -- Add: only my_request; Edit & Delete: view split handled by frontend canUserEditRecord
    ('add_request', 'my_request', '[sr_creater],[requester]', 'Add Request', 'Add new request records'),
    ('edit_request', 'my_request,my_process_owner,my_task,my_team', NULL, 'Edit Request', 'Edit request records. Hiển thị ở My Request (cho SR Creater/Requester), My Process Owner/My Team (cho Policy Lead/SR Owner).'),
    ('delete_request', 'my_request', '[sr_creater],[requester]', 'Delete Request', 'Delete request records. Chỉ hiển thị khi Status = Draft hoặc Cancelled.'),

    ('add_my_request', 'my_request', NULL, 'Add Request (My Request)', 'Create a new request from My Requests'),

    ('add_support', 'support', NULL, 'Add Support Ticket', 'Allow submitting support tickets'),
    ('edit_support', 'support', NULL, 'Edit Support Ticket', 'Allow editing support tickets'),

    ('add_service', 'request', NULL, 'Add Service', 'Add new service records'),
    ('edit_service', 'request', NULL, 'Edit Service', 'Edit service records'),
    ('delete_service', 'request', NULL, 'Delete Service', 'Delete service records'),

    ('add_asset', 'request', NULL, 'Add Asset', 'Add new asset records'),
    ('edit_asset', 'request', NULL, 'Edit Asset', 'Edit asset records'),
    ('delete_asset', 'request', NULL, 'Delete Asset', 'Delete asset records'),

    ('add_target_table', 'request', NULL, 'Add Target Table Config', 'Add target table config records'),
    ('edit_target_table', 'request', NULL, 'Edit Target Table Config', 'Edit target table config records'),
    ('delete_target_table', 'request', NULL, 'Delete Target Table Config', 'Delete target table config records'),

    ('add_mtr', 'request', NULL, 'Add Transaction', 'Add new money transaction records'),
    ('edit_mtr', 'request', NULL, 'Edit Transaction', 'Edit money transaction records'),
    ('delete_mtr', 'request', NULL, 'Delete Transaction', 'Delete money transaction records'),

    ('add_account', 'account', NULL, 'Add Account', 'Add new account records'),
    ('edit_account', 'account', NULL, 'Edit Account', 'Edit account records'),
    ('delete_account', 'account', NULL, 'Delete Account', 'Delete account records'),

    ('add_company', 'company', NULL, 'Add Company', 'Add new company records'),
    ('edit_company', 'company', NULL, 'Edit Company', 'Edit company records'),
    ('delete_company', 'company', NULL, 'Delete Company', 'Delete company records'),

    ('add_my_company', 'my_company', NULL, 'Add Company (My Company)', 'Add new internal company records'),
    ('edit_my_company', 'my_company', NULL, 'Edit Company (My Company)', 'Edit internal company records'),
    ('delete_my_company', 'my_company', NULL, 'Delete Company (My Company)', 'Delete internal company records'),

    ('add_finance', 'finance', NULL, 'Add Finance Category', 'Add new finance category records'),
    ('edit_finance', 'finance', NULL, 'Edit Finance Category', 'Edit finance category records'),
    ('delete_finance', 'finance', NULL, 'Delete Finance Category', 'Delete finance category records'),

    ('add_department', 'department', NULL, 'Add Department', 'Add new department records'),
    ('edit_department', 'department', NULL, 'Edit Department', 'Edit department records'),
    ('delete_department', 'department', NULL, 'Delete Department', 'Delete department records'),

    ('add_policy', 'policy', NULL, 'Add Policy', 'Add new policy records'),
    ('edit_policy', 'policy', NULL, 'Edit Policy', 'Edit policy records'),
    ('delete_policy', 'policy', NULL, 'Delete Policy', 'Delete policy records'),

    ('add_opportunity_list', 'opportunity_list', NULL, 'Add Opportunity', 'Add new opportunity records'),
    ('edit_opportunity_list', 'opportunity_list', NULL, 'Edit Opportunity', 'Edit opportunity records'),
    ('delete_opportunity_list', 'opportunity_list', NULL, 'Delete Opportunity', 'Delete opportunity records'),

    ('add_contact', 'contact', NULL, 'Add Contact', 'Add new contact records'),
    ('edit_contact', 'contact', NULL, 'Edit Contact', 'Edit contact records'),
    ('delete_contact', 'contact', NULL, 'Delete Contact', 'Delete contact records'),

    ('add_invoice', 'request', NULL, 'Add Invoice', 'Add new invoice records'),
    ('edit_invoice', 'request', NULL, 'Edit Invoice', 'Edit invoice records'),
    ('delete_invoice', 'request', NULL, 'Delete Invoice', 'Delete invoice records'),

    ('add_my_location', 'my_location', NULL, 'Add Location', 'Add new location records'),
    ('edit_my_location', 'my_location', NULL, 'Edit Location', 'Edit location records'),
    ('delete_my_location', 'my_location', NULL, 'Delete Location', 'Delete location records'),

    ('add_permissions', 'permissions', NULL, 'Add Column Permission', 'Add new column permission records'),
    ('edit_permissions', 'permissions', NULL, 'Edit Column Permission', 'Edit column permission records'),
    ('delete_permissions', 'permissions', NULL, 'Delete Column Permission', 'Delete column permission records'),

    ('add_exception_rules', 'exception_rules', NULL, 'Add Menu Rule', 'Add new menu exception rule records'),
    ('edit_exception_rules', 'exception_rules', NULL, 'Edit Menu Rule', 'Edit menu exception rule records'),
    ('delete_exception_rules', 'exception_rules', NULL, 'Delete Menu Rule', 'Delete menu exception rule records'),

    ('add_action_rules', 'action_rules', NULL, 'Add Action Rule', 'Add new action rule records'),
    ('edit_action_rules', 'action_rules', NULL, 'Edit Action Rule', 'Edit action rule records'),
    ('delete_action_rules', 'action_rules', NULL, 'Delete Action Rule', 'Delete action rule records'),

    -- Virtual views for Request
    ('edit_my_request', 'my_request', NULL, 'Edit Request (My Request)', 'Edit requests in My Request view'),
    ('delete_my_request', 'my_request', NULL, 'Delete Request (My Request)', 'Delete requests in My Request view'),

    ('add_my_approval', 'my_approval', NULL, 'Add Request (My Approval)', 'Add request from My Approval view'),
    ('edit_my_approval', 'my_approval', NULL, 'Edit Request (My Approval)', 'Edit request in My Approval view'),
    ('delete_my_approval', 'my_approval', NULL, 'Delete Request (My Approval)', 'Delete request in My Approval view'),

    ('add_my_process_owner', 'my_process_owner', NULL, 'Add Request (My Process Owner)', 'Add request from My Process Owner view'),
    ('edit_my_process_owner', 'my_process_owner', NULL, 'Edit Request (My Process Owner)', 'Edit request in My Process Owner view'),
    ('delete_my_process_owner', 'my_process_owner', NULL, 'Delete Request (My Process Owner)','Delete request in My Process Owner view'),

    ('add_my_task', 'my_task', NULL, 'Add Request (My Process Owner)', 'Add request from My Process Owner view'),
    ('edit_my_task', 'my_task', NULL, 'Edit Request (My Process Owner)', 'Edit request in My Process Owner view'),
    ('delete_my_task', 'my_task', NULL, 'Delete Request (My Process Owner)','Delete request in My Process Owner view'),

    ('add_my_team', 'my_team', NULL, 'Add Request (My Process)', 'Add request from My Process view'),
    ('edit_my_team', 'my_team', NULL, 'Edit Request (My Team)', 'Edit request in My Team view'),
    ('delete_my_team', 'my_team', NULL, 'Delete Request (My Team)', 'Delete request in My Team view'),

    -- Comment
    ('delete_comment', 'comment', NULL, 'Delete Comment', 'Delete a comment record'),

    -- Assigned Task CRUD actions
    ('add_assigned_task', 'request', '[Super Admin],[Admin],[HR],[Staff]', 'Add Assigned Task', 'Add new task assignment'),
    ('edit_assigned_task', 'request', '[Super Admin],[Admin],[HR],[Staff]', 'Edit Assigned Task', 'Edit task assignment details'),
    ('delete_assigned_task', 'request', '[Super Admin],[Admin],[HR],[Staff]', 'Delete Assigned Task', 'Delete task assignment'),
    ('update_task_status', 'assigned_task', '[employee_id],[request.policy_lead],[request.sr_owner]', 'Update Status', 'Allow assignee to update status of the task'),

    -- Task Subtask CRUD actions
    ('add_task_subtask', 'task_subtask', NULL, 'Add Subtask', 'Add subtask to task'),
    ('edit_task_subtask', 'task_subtask', NULL, 'Edit Subtask', 'Edit subtask details'),
    ('delete_task_subtask', 'task_subtask', NULL, 'Delete Subtask', 'Delete subtask')
  ON CONFLICT (action_id) DO NOTHING;

  -- Remove allocation action_rules (Allocation Finance feature removed)
  DELETE FROM action_rules WHERE action_id IN ('allocate_contract', 'allocate_invoice', 'split_payment');


  -- Force-upsert critical virtual view CRUD rules (handles cases where prior migrations ran DO NOTHING)
  -- These entries MUST exist and MUST have correct display_name/description.
  INSERT INTO action_rules (action_id, view_name, roles, display_name, description, display)
  VALUES
    ('add_my_request',      'my_request',      NULL, 'Add Request (My Request)',        'Create a new request from My Requests',           true),
    ('edit_my_request',     'my_request',      NULL, 'Edit Request (My Request)',        'Edit requests in My Request view',                true),
    ('delete_my_request',   'my_request',      NULL, 'Delete Request (My Request)',      'Delete requests in My Request view',              true),

    ('add_my_approval',     'my_approval',     NULL, 'Add Request (My Approval)',        'Add request from My Approval view',               true),
    ('edit_my_approval',    'my_approval',     NULL, 'Edit Request (My Approval)',        'Edit request in My Approval view',                true),
    ('delete_my_approval',  'my_approval',     NULL, 'Delete Request (My Approval)',     'Delete request in My Approval view',              true),

    ('add_my_process_owner','my_process_owner',NULL, 'Add Request (My Process Owner)',   'Add request from My Process Owner view',           true),
    ('edit_my_process_owner','my_process_owner',NULL,'Edit Request (My Process Owner)',  'Edit request in My Process Owner view',            true),
    ('delete_my_process_owner','my_process_owner',NULL,'Delete Request (My Process Owner)','Delete request in My Process Owner view',        true),

    ('add_my_task',         'my_task',         NULL, 'Add Request (My Process Owner)',   'Add request from My Process Owner view',           true),
    ('edit_my_task',        'my_task',         NULL, 'Edit Request (My Process Owner)',  'Edit request in My Process Owner view',            true),
    ('delete_my_task',      'my_task',         NULL, 'Delete Request (My Process Owner)','Delete request in My Process Owner view',          true),

    ('add_my_team',         'my_team',         NULL, 'Add Request (My Process)',         'Add request from My Process view',                 true),
    ('edit_my_team',        'my_team',         NULL, 'Edit Request (My Process)',        'Edit request in My Process view',                  true),
    ('delete_my_team',      'my_team',         NULL, 'Delete Request (My Team)',         'Delete request in My Team view',                  true),

    ('add_contract',        'request',         NULL, 'Add Contract',                     'Add new contract records',                        true),
    ('edit_contract',       'request',         NULL, 'Edit Contract',                    'Edit contract records',                           true),
    ('delete_contract',     'request',         NULL, 'Delete Contract',                  'Delete contract records',                         true),

    ('add_expense',         'request',         NULL, 'Add Expense',                      'Add new expense records',                         true),
    ('edit_expense',        'request',         NULL, 'Edit Expense',                     'Edit expense records',                            true),
    ('delete_expense',      'request',         NULL, 'Delete Expense',                   'Delete expense records',                          true),

    ('delete_comment',      'comment',         NULL, 'Delete Comment',                   'Delete a comment record',                         true)
  ON CONFLICT (action_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        description  = EXCLUDED.description;
  -- NOTE: display is intentionally NOT reset here so admins can still turn off these buttons.

  -- Clean up approval_flow for Tier 0 requests so they do not have fake steps/approvers
  UPDATE request r
  SET approval_flow = '{"steps": [], "total_levels": 0, "current_level": 0}'::jsonb
  FROM policy_and_program p
  WHERE p.policy_id::text = r.request_type::text
    AND (p.approval_level ILIKE '%tier 0%' OR p.approval_level = '0')
    AND (r.approval_level IS NULL OR r.approval_level ILIKE '%standard%')
    AND (
      r.approval_flow IS NULL
      OR (r.approval_flow->>'total_levels')::int != 0
      OR jsonb_array_length(COALESCE(r.approval_flow->'steps', '[]'::jsonb)) > 0
    );

  -- Create custom performance indexes for sorting columns to speed up page/menu switching
  CREATE INDEX IF NOT EXISTS idx_payment_due_date ON payment (due_date DESC NULLS LAST);
  DROP INDEX IF EXISTS idx_expense_created_date;
  CREATE INDEX IF NOT EXISTS idx_service_end_date ON service (end_date DESC NULLS LAST);
  CREATE INDEX IF NOT EXISTS idx_asset_purchase_date ON asset (purchase_date DESC NULLS LAST);
  CREATE INDEX IF NOT EXISTS idx_mtr_transaction_date ON mtr (transaction_date DESC NULLS LAST);
  DROP INDEX IF EXISTS idx_request_sr_created_date;
  CREATE INDEX IF NOT EXISTS idx_request_sr_submitted_date ON request (sr_submitted_date DESC NULLS LAST);
  CREATE INDEX IF NOT EXISTS idx_request_sr_creater ON request (sr_creater);
  CREATE INDEX IF NOT EXISTS idx_request_policy_lead ON request (policy_lead);
  DROP INDEX IF EXISTS idx_request_tier_1_approval;
  DROP INDEX IF EXISTS idx_request_tier_2_approval;
  DROP INDEX IF EXISTS idx_request_tier_3_approval;

  -- Create safe JSONB parsing function if not exists
  CREATE OR REPLACE FUNCTION safe_parse_jsonb(val text)
  RETURNS jsonb AS $$
  BEGIN
      RETURN val::jsonb;
  EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
          'timestamp', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'user', 'system',
          'action', val,
          'changes', '{}'::jsonb
      );
  END;
  $$ LANGUAGE plpgsql;

  -- Migrate existing tables with TEXT log columns to JSONB
  DO $$
  DECLARE
      r RECORD;
      t_name text;
      col_type text;
      has_created_date boolean;
      has_created_by boolean;
      c_date_expr text;
      c_by_expr text;
  BEGIN
      FOR r IN (
          SELECT c.table_name
          FROM information_schema.columns c
          JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
          WHERE c.column_name = 'log' 
            AND c.table_schema = current_schema() 
            AND t.table_type = 'BASE TABLE'
      ) LOOP
          t_name := r.table_name;
          
          SELECT data_type INTO col_type
          FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = t_name AND column_name = 'log';
          
          IF col_type = 'text' OR col_type = 'character varying' THEN
              SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=t_name AND column_name='created_date') INTO has_created_date;
              SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=t_name AND column_name='created_by') INTO has_created_by;
              
              IF has_created_date THEN
                  c_date_expr := 'created_date';
              ELSE
                  c_date_expr := 'CURRENT_TIMESTAMP';
              END IF;
              
              IF has_created_by THEN
                  c_by_expr := 'created_by';
              ELSE
                  c_by_expr := '''system''';
              END IF;

              -- 1. Create a temporary log_new column
              EXECUTE format('ALTER TABLE ONLY %I ADD COLUMN log_new jsonb DEFAULT %L', t_name, '[]'::jsonb);
              
              -- 2. Migrate data
              EXECUTE format('
                  UPDATE %I
                  SET log_new = COALESCE((
                      SELECT jsonb_agg(
                          CASE 
                              WHEN trim(line) = %L THEN NULL
                              WHEN trim(line) LIKE %L THEN safe_parse_jsonb(line)
                              ELSE jsonb_build_object(
                                  %L, to_char(COALESCE(' || c_date_expr || ', CURRENT_TIMESTAMP), %L),
                                  %L, COALESCE(' || c_by_expr || ', %L),
                                  %L, trim(line),
                                  %L, %L::jsonb
                              )
                          END
                      )
                      FROM unnest(string_to_array(log, E%L)) AS line
                      WHERE trim(line) <> %L
                  ), %L::jsonb)
                  WHERE log IS NOT NULL AND log <> %L;
              ', 
              t_name, 
              '', 
              '{%}', 
              'timestamp', 'MM/DD/YYYY HH24:MI:SS', 
              'user', 'system', 
              'action', 
              'changes', '{}',
              '\n', 
              '', 
              '[]', 
              '');
              
              -- 3. Swap columns
              EXECUTE format('ALTER TABLE ONLY %I DROP COLUMN log', t_name);
              EXECUTE format('ALTER TABLE ONLY %I RENAME COLUMN log_new TO log', t_name);
              EXECUTE format('ALTER TABLE ONLY %I ALTER COLUMN log SET DEFAULT %L::jsonb', t_name, '[]'::jsonb);
          END IF;
      END LOOP;
  END $$;

  -- Create the centralized audit_logs table if not exists
  CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      table_name VARCHAR(100) NOT NULL,
      record_id VARCHAR(100) NOT NULL,
      action VARCHAR(50) NOT NULL,
      changes JSONB,
      changed_by VARCHAR(100),
      tx_id BIGINT DEFAULT txid_current(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

  -- Create target_table table if not exists
  CREATE TABLE IF NOT EXISTS target_table (
      target_table_id VARCHAR(50) PRIMARY KEY,
      request VARCHAR(50),
      type VARCHAR(50),
      table_name VARCHAR(50),
      record_ids TEXT[]
  );

  -- Create assigned_task table if not exists
  CREATE TABLE IF NOT EXISTS assigned_task (
      task_id VARCHAR(50) PRIMARY KEY,
      request_id VARCHAR(50),
      employee_id VARCHAR(50),
      deadline DATE,
      description TEXT,
      task_info_link TEXT,
      task_info_guide_file TEXT,
      task_info_notes TEXT,
      task_info_report TEXT,
      task_info_comment TEXT,
      status VARCHAR(50) DEFAULT 'Not started yet',
      log JSONB DEFAULT '[]'::jsonb
  );

  -- Create task_subtask table if not exists
  CREATE TABLE IF NOT EXISTS task_subtask (
      subtask_id VARCHAR(50) PRIMARY KEY,
      task_id VARCHAR(50),
      description TEXT,
      status VARCHAR(50) DEFAULT 'Pending',
      log JSONB DEFAULT '[]'::jsonb
  );




  -- Register / update the audit_log_trigger function and apply to all tables
  CREATE OR REPLACE FUNCTION audit_log_trigger()
  RETURNS TRIGGER AS $$
  DECLARE
      v_pk_col TEXT;
      v_record_id TEXT;
      v_action TEXT;
      user_val TEXT;
      changed_fields JSONB;
  BEGIN
      -- Query the primary key column name dynamically from postgres catalogs
      SELECT a.attname INTO v_pk_col
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = TG_RELID AND i.indisprimary
      LIMIT 1;

      IF v_pk_col IS NULL THEN
          v_pk_col := 'id'; -- Fallback
      END IF;

      -- Resolve the record_id based on operation
      IF (TG_OP = 'DELETE') THEN
          v_record_id := COALESCE(to_jsonb(OLD) ->> v_pk_col, 'unknown');
      ELSE
          v_record_id := COALESCE(to_jsonb(NEW) ->> v_pk_col, 'unknown');
      END IF;

      -- Resolve the user executing the change
      BEGIN
          user_val := current_setting('app.current_user', true);
      EXCEPTION WHEN OTHERS THEN
          user_val := NULL;
      END;

      IF user_val IS NULL OR user_val = '' THEN
          IF (TG_OP = 'DELETE') THEN
              user_val := COALESCE(
                  to_jsonb(OLD) ->> 'updated_by',
                  to_jsonb(OLD) ->> 'created_by',
                  to_jsonb(OLD) ->> 'comment_by',
                  'system'
              );
          ELSE
              user_val := COALESCE(
                  to_jsonb(NEW) ->> 'updated_by',
                  to_jsonb(NEW) ->> 'created_by',
                  to_jsonb(NEW) ->> 'comment_by',
                  'system'
              );
          END IF;
      END IF;

      IF (TG_OP = 'INSERT') THEN
          v_action := 'created record';
          
          SELECT jsonb_object_agg(key, jsonb_build_object('old', null, 'new', value)) INTO changed_fields
          FROM jsonb_each(to_jsonb(NEW))
          WHERE key NOT IN ('log', 'logs', 'notification_logs', 'updated_date', 'updated_by', 'created_date', 'created_by') AND value IS NOT NULL;

          IF changed_fields IS NOT NULL AND changed_fields != '{}'::jsonb THEN
              INSERT INTO audit_logs (table_name, record_id, action, changes, changed_by)
              VALUES (TG_TABLE_NAME, v_record_id, v_action, changed_fields, user_val);
          END IF;

      ELSIF (TG_OP = 'UPDATE') THEN
          v_action := 'updated record';

          SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val)) INTO changed_fields
          FROM (
              SELECT o.key, o.value as old_val, n.value as new_val
              FROM jsonb_each(to_jsonb(OLD)) o
              JOIN jsonb_each(to_jsonb(NEW)) n ON o.key = n.key
              WHERE o.value IS DISTINCT FROM n.value
                AND o.key NOT IN ('log', 'logs', 'notification_logs', 'updated_date', 'updated_by', 'created_date', 'created_by')
          ) t;

          IF changed_fields IS NOT NULL AND changed_fields != '{}'::jsonb THEN
              INSERT INTO audit_logs (table_name, record_id, action, changes, changed_by)
              VALUES (TG_TABLE_NAME, v_record_id, v_action, changed_fields, user_val);
          END IF;

      ELSIF (TG_OP = 'DELETE') THEN
          v_action := 'deleted record';
          
          -- Storing the entire old record state as the changes payload during delete
          INSERT INTO audit_logs (table_name, record_id, action, changes, changed_by)
          VALUES (TG_TABLE_NAME, v_record_id, v_action, to_jsonb(OLD), user_val);
          
          RETURN OLD;
      END IF;

      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Ensure all tables have log columns, drop deprecated columns, and register the trigger
  DO $$
  DECLARE
      r RECORD;
  BEGIN
      FOR r IN (
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = current_schema() 
            AND table_type = 'BASE TABLE'
            AND table_name NOT IN ('pg_stat_statements', 'push_subscriptions', 'audit_logs')
      ) LOOP
          -- 1. Ensure log column exists as JSONB
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = current_schema() AND table_name = r.table_name AND column_name = 'log'
          ) THEN
              EXECUTE format('ALTER TABLE %I ADD COLUMN log jsonb DEFAULT ''[]''::jsonb', r.table_name);
          END IF;

          -- 3. Register the trigger
          EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_log ON %I', r.table_name);
          EXECUTE format('CREATE TRIGGER trg_audit_log BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_log_trigger()', r.table_name);
      END LOOP;
  END;
  $$;

  -- Create / Apply Soft delete column to all tables
  DO $$
  DECLARE
      r RECORD;
      t_name text;
  BEGIN
      FOR r IN (
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
            AND table_name NOT IN ('pg_stat_statements', 'push_subscriptions')
      ) LOOP
          t_name := r.table_name;
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = current_schema() AND table_name = t_name AND column_name = 'deleted_at'
          ) THEN
              EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL', t_name);
          END IF;
      END LOOP;
  END $$;

  -- Create soft delete cascade trigger function
  CREATE OR REPLACE FUNCTION cascade_soft_delete_trigger()
  RETURNS TRIGGER AS $$
  DECLARE
      r RECORD;
      child_table_name text;
      child_col_name text;
      parent_col_name text;
      val_to_match text;
      has_deleted_at_col boolean;
  BEGIN
      IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
          -- Cascade using database foreign key constraints
          FOR r IN (
              SELECT DISTINCT
                  kcu.table_name AS child_table,
                  kcu.column_name AS child_column,
                  ccu.column_name AS parent_column
              FROM information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
              JOIN information_schema.referential_constraints AS rc
                  ON tc.constraint_name = rc.constraint_name
              JOIN information_schema.constraint_column_usage AS ccu
                  ON rc.unique_constraint_name = ccu.constraint_name
                  AND rc.unique_constraint_schema = ccu.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY'
                AND ccu.table_name = TG_TABLE_NAME
          ) LOOP
              child_table_name := r.child_table;
              child_col_name := r.child_column;
              parent_col_name := r.parent_column;
              
              EXECUTE format('SELECT ($1).%I::text', parent_col_name) USING NEW INTO val_to_match;
              
              IF val_to_match IS NOT NULL THEN
                  SELECT EXISTS (
                      SELECT 1 FROM information_schema.columns 
                      WHERE table_schema = current_schema() AND table_name = child_table_name AND column_name = 'deleted_at'
                  ) INTO has_deleted_at_col;
                  
                  IF has_deleted_at_col THEN
                      EXECUTE format(
                          'UPDATE %I SET deleted_at = $1 WHERE %I = $2 AND deleted_at IS NULL',
                          child_table_name, child_col_name
                      ) USING NEW.deleted_at, val_to_match;
                  END IF;
              END IF;
          END LOOP;
          
          -- Cascade using logical request relationships
          IF TG_TABLE_NAME = 'request' THEN
              val_to_match := NEW.request_id;
              IF val_to_match IS NOT NULL THEN
                  FOR child_table_name IN 
                      SELECT unnest(ARRAY['payment', 'invoice', 'mtr', 'service', 'asset', 'comment', 'contract'])
                  LOOP
                      SELECT EXISTS (
                          SELECT 1 FROM information_schema.columns 
                          WHERE table_schema = current_schema() AND table_name = child_table_name AND column_name = 'deleted_at'
                      ) INTO has_deleted_at_col;
                      
                      IF has_deleted_at_col THEN
                          EXECUTE format(
                              'UPDATE %I SET deleted_at = $1 WHERE request = $2 AND deleted_at IS NULL',
                              child_table_name
                          ) USING NEW.deleted_at, val_to_match;
                      END IF;
                  END LOOP;
              END IF;
          END IF;
      ELSIF (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
          -- Cascade restore using database foreign key constraints
          FOR r IN (
              SELECT DISTINCT
                  kcu.table_name AS child_table,
                  kcu.column_name AS child_column,
                  ccu.column_name AS parent_column
              FROM information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
              JOIN information_schema.referential_constraints AS rc
                  ON tc.constraint_name = rc.constraint_name
              JOIN information_schema.constraint_column_usage AS ccu
                  ON rc.unique_constraint_name = ccu.constraint_name
                  AND rc.unique_constraint_schema = ccu.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY'
                AND ccu.table_name = TG_TABLE_NAME
          ) LOOP
              child_table_name := r.child_table;
              child_col_name := r.child_column;
              parent_col_name := r.parent_column;
              
              EXECUTE format('SELECT ($1).%I::text', parent_col_name) USING NEW INTO val_to_match;
              
              IF val_to_match IS NOT NULL THEN
                  SELECT EXISTS (
                      SELECT 1 FROM information_schema.columns 
                      WHERE table_schema = current_schema() AND table_name = child_table_name AND column_name = 'deleted_at'
                  ) INTO has_deleted_at_col;
                  
                  IF has_deleted_at_col THEN
                      EXECUTE format(
                          'UPDATE %I SET deleted_at = NULL WHERE %I = $1 AND deleted_at IS NOT NULL',
                          child_table_name, child_col_name
                      ) USING val_to_match;
                  END IF;
              END IF;
          END LOOP;
          
          -- Cascade restore using logical request relationships
          IF TG_TABLE_NAME = 'request' THEN
              val_to_match := NEW.request_id;
              IF val_to_match IS NOT NULL THEN
                  FOR child_table_name IN 
                      SELECT unnest(ARRAY['payment', 'invoice', 'mtr', 'service', 'asset', 'comment', 'contract'])
                  LOOP
                      SELECT EXISTS (
                          SELECT 1 FROM information_schema.columns 
                          WHERE table_schema = current_schema() AND table_name = child_table_name AND column_name = 'deleted_at'
                      ) INTO has_deleted_at_col;
                      
                      IF has_deleted_at_col THEN
                          EXECUTE format(
                              'UPDATE %I SET deleted_at = NULL WHERE request = $1 AND deleted_at IS NOT NULL',
                              child_table_name
                          ) USING val_to_match;
                      END IF;
                  END LOOP;
              END IF;
          END IF;
      END IF;
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Apply soft-delete cascade trigger to all tables that have the deleted_at column
  DO $$
  DECLARE
      r RECORD;
  BEGIN
      FOR r IN (
          SELECT t.table_name 
          FROM information_schema.tables t
          JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
          WHERE c.column_name = 'deleted_at' 
            AND t.table_schema = current_schema() 
            AND t.table_type = 'BASE TABLE'
      ) LOOP
          EXECUTE format('DROP TRIGGER IF EXISTS trg_cascade_soft_delete ON %I', r.table_name);
          EXECUTE format('CREATE TRIGGER trg_cascade_soft_delete AFTER UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION cascade_soft_delete_trigger()', r.table_name);
      END LOOP;
    -- Rename columns on operation_program if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'operation_program' AND column_name = 'expense_code') THEN
      ALTER TABLE "operation_program" RENAME COLUMN "expense_code" TO "payment_code";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'operation_program' AND column_name = 'expense_name') THEN
      ALTER TABLE "operation_program" RENAME COLUMN "expense_name" TO "payment_name";
    END IF;

    -- Add columns to operation_program if not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'operation_program' AND column_name = 'department_id') THEN
      ALTER TABLE "operation_program" ADD COLUMN "department_id" varchar(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'operation_program' AND column_name = 'company_id') THEN
      ALTER TABLE "operation_program" ADD COLUMN "company_id" varchar(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'operation_program' AND column_name = 'finance_mappings') THEN
      ALTER TABLE "operation_program" ADD COLUMN "finance_mappings" jsonb DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'operation_program' AND column_name = 'payment_type') THEN
      ALTER TABLE "operation_program" ADD COLUMN "payment_type" varchar(50);
    END IF;

    -- Drop obsolete operation_program_id and id__finance_category columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'contract' AND column_name = 'operation_program_id') THEN
      ALTER TABLE "contract" DROP COLUMN "operation_program_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'invoice' AND column_name = 'operation_program_id') THEN
      ALTER TABLE "invoice" DROP COLUMN "operation_program_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'payment' AND column_name = 'operation_program_id') THEN
      ALTER TABLE "payment" DROP COLUMN "operation_program_id";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'expense' AND column_name = 'id__finance_category') THEN
      ALTER TABLE "expense" DROP COLUMN "id__finance_category";
    END IF;

    -- Remove finance_splits column from contract table (Allocation Finance removed)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'contract' AND column_name = 'finance_splits') THEN
      ALTER TABLE "contract" DROP COLUMN "finance_splits";
    END IF;

    -- Remove finance_splits column from invoice table (Allocation Finance removed)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'invoice' AND column_name = 'finance_splits') THEN
      ALTER TABLE "invoice" DROP COLUMN "finance_splits";
    END IF;

    -- Remove finance_splits column from payment table (Allocation Finance removed)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'payment' AND column_name = 'finance_splits') THEN
      ALTER TABLE "payment" DROP COLUMN "finance_splits";
    END IF;

    -- Drop obsolete expense_type column on operation_program if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'operation_program' AND column_name = 'expense_type') THEN
      ALTER TABLE "operation_program" DROP COLUMN "expense_type";
    END IF;
  END $$;

  -- Drop temporary tables if they exist (Option 2 cleanup)
  DROP TABLE IF EXISTS public.contract_payment CASCADE;
  DROP TABLE IF EXISTS public.contract_invoice CASCADE;

  -- Add contract_id columns to payment and invoice tables if not exists
  ALTER TABLE public.payment ADD COLUMN IF NOT EXISTS contract_id character varying(50);
  ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS contract_id character varying(50);
  ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS payment_id character varying(50);

  -- Add source columns to payment and invoice tables if not exists
  ALTER TABLE public.payment ADD COLUMN IF NOT EXISTS source character varying(50) DEFAULT 'Request';
  ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS source character varying(50) DEFAULT 'Request';

  -- Add columns to invoice table for VAT and Total Value calculations
  ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS total_value numeric;
  ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS value_before_vat_in_base_currency numeric;
  ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS vat_value_in_base_currency numeric;
  ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS total_value_in_base_currency numeric;

  -- Add columns to payment table for Base Currency
  ALTER TABLE public.payment ADD COLUMN IF NOT EXISTS vat numeric DEFAULT 0;
  ALTER TABLE public.payment ADD COLUMN IF NOT EXISTS total_value numeric;
  ALTER TABLE public.payment ADD COLUMN IF NOT EXISTS value_in_base_currency numeric;
  ALTER TABLE public.payment ADD COLUMN IF NOT EXISTS finance_splits jsonb DEFAULT '[]'::jsonb;

  -- Add columns to expense table for Base Currency and Total Value
  ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS total_value numeric;
  ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS value_before_vat_in_base_currency numeric;
  ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS vat_value_in_base_currency numeric;
  ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS total_value_in_base_currency numeric;

  -- Add columns to contract table for Base Currency and Total Value
  ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS total_value numeric;
  ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS value_before_vat_in_base_currency numeric;
  ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS vat_value_in_base_currency numeric;
  ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS total_value_in_base_currency numeric;

  -- Add columns to asset table for Base Currency
  ALTER TABLE public.asset ADD COLUMN IF NOT EXISTS value_in_base_currency numeric;

  -- Backfill contract_id in payment table
  UPDATE public.payment p
  SET contract_id = c.contract_id, source = 'Contract'
  FROM public.contract c
  WHERE p.contractspood = c.contractspood_no AND p.contract_id IS NULL;

  -- Backfill source in invoice table
  UPDATE public.invoice
  SET source = 'Contract'
  WHERE contract_id IS NOT NULL AND source IS DISTINCT FROM 'Contract';

  -- Set default source for remaining payments & invoices
  UPDATE public.payment SET source = 'Request' WHERE source IS NULL;
  UPDATE public.invoice SET source = 'Request' WHERE source IS NULL;

  -- Backfill total_value & value_in_base_currency in payment table
  UPDATE public.payment SET total_value = COALESCE(value, 0) + COALESCE(vat, 0) WHERE total_value IS NULL;
  UPDATE public.payment SET value_in_base_currency = ROUND(COALESCE(value, 0) * COALESCE(exchange_rate, 1)) WHERE value_in_base_currency IS NULL;

  -- Backfill base currency in asset table
  UPDATE public.asset SET value_in_base_currency = ROUND(COALESCE(NULLIF(regexp_replace(purchase_cost, '[^0-9.]', '', 'g'), '')::numeric, 0) * COALESCE(NULLIF(regexp_replace(exchange_rate, '[^0-9.]', '', 'g'), '')::numeric, 1)) WHERE value_in_base_currency IS NULL;

  -- Backfill total_value & base currency in expense table
  UPDATE public.expense SET 
    total_value = COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0),
    value_before_vat_in_base_currency = ROUND(COALESCE(value_before_vat, 0) * COALESCE(exchange_rate, 1)),
    vat_value_in_base_currency = ROUND(COALESCE(vat_value, 0) * COALESCE(exchange_rate, 1)),
    total_value_in_base_currency = ROUND((COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) * COALESCE(exchange_rate, 1))
  WHERE total_value IS NULL OR total_value_in_base_currency IS NULL;

  -- Backfill total_value & base currency in contract table
  UPDATE public.contract SET 
    total_value = COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0),
    value_before_vat_in_base_currency = ROUND(COALESCE(value_before_vat, 0) * COALESCE(exchance_rate, 1)),
    vat_value_in_base_currency = ROUND(COALESCE(vat_value, 0) * COALESCE(exchance_rate, 1)),
    total_value_in_base_currency = ROUND((COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) * COALESCE(exchance_rate, 1))
  WHERE total_value IS NULL OR total_value_in_base_currency IS NULL;

  -- Backfill total_value & base currency in invoice table
  UPDATE public.invoice SET 
    value_before_vat_in_base_currency = ROUND(COALESCE(value_before_vat, 0) * COALESCE(exchange_rate, 1)),
    vat_value_in_base_currency = ROUND(COALESCE(NULLIF(regexp_replace(vat_value::text, '[^0-9.]', '', 'g'), '')::numeric, 0) * COALESCE(exchange_rate, 1)),
    total_value_in_base_currency = ROUND((COALESCE(value_before_vat, 0) + COALESCE(NULLIF(regexp_replace(vat_value::text, '[^0-9.]', '', 'g'), '')::numeric, 0)) * COALESCE(exchange_rate, 1))
  WHERE value_before_vat_in_base_currency IS NULL;

  -- Create or replace function to sync request from contract
  CREATE OR REPLACE FUNCTION public.sync_request_and_source_from_contract()
  RETURNS TRIGGER AS $sync_req$
  BEGIN
      IF NEW.contract_id IS NOT NULL THEN
          SELECT request INTO NEW.request FROM public.contract WHERE contract_id = NEW.contract_id;
          NEW.source := 'Contract';
      ELSE
          IF NEW.source IS NULL THEN
              NEW.source := 'Request';
          END IF;
      END IF;
      RETURN NEW;
  END;
  $sync_req$ LANGUAGE plpgsql;

  -- Create triggers on payment and invoice to sync request BEFORE INSERT OR UPDATE
  DROP TRIGGER IF EXISTS trg_sync_payment_request ON public.payment;
  CREATE TRIGGER trg_sync_payment_request
  BEFORE INSERT OR UPDATE ON public.payment
  FOR EACH ROW EXECUTE FUNCTION public.sync_request_and_source_from_contract();

  DROP TRIGGER IF EXISTS trg_sync_invoice_request ON public.invoice;
  CREATE TRIGGER trg_sync_invoice_request
  BEFORE INSERT OR UPDATE ON public.invoice
  FOR EACH ROW EXECUTE FUNCTION public.sync_request_and_source_from_contract();

  -- Create or replace function to propagate request changes from contract
  CREATE OR REPLACE FUNCTION public.propagate_contract_request_change()
  RETURNS TRIGGER AS $prop_req$
  BEGIN
      IF OLD.request IS DISTINCT FROM NEW.request THEN
          UPDATE public.payment SET request = NEW.request WHERE contract_id = NEW.contract_id;
          UPDATE public.invoice SET request = NEW.request WHERE contract_id = NEW.contract_id;
      END IF;
      RETURN NEW;
  END;
  $prop_req$ LANGUAGE plpgsql;

  -- Create trigger on contract to propagate request changes AFTER UPDATE
  DROP TRIGGER IF EXISTS trg_propagate_contract_request ON public.contract;
  CREATE TRIGGER trg_propagate_contract_request
  AFTER UPDATE OF request ON public.contract
  FOR EACH ROW EXECUTE FUNCTION public.propagate_contract_request_change();

    -- Notification table schema
    CREATE TABLE IF NOT EXISTS "notification" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_employee_id VARCHAR(255),
      title VARCHAR(255),
      body TEXT,
      link VARCHAR(512),
      is_read BOOLEAN DEFAULT FALSE,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_pinned BOOLEAN DEFAULT FALSE,
      is_flagged BOOLEAN DEFAULT FALSE,
      flagged_note TEXT,
      deleted_at TIMESTAMP,
      log JSONB
    );
    ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS user_employee_id VARCHAR(255);
    ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
    ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
    ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
    ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS flagged_note TEXT;
    ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_expense_id__request ON public.expense(id__request);
    CREATE INDEX IF NOT EXISTS idx_expense_deleted_at ON public.expense(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_asset_request ON public.asset(request);
    CREATE INDEX IF NOT EXISTS idx_asset_deleted_at ON public.asset(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_contract_id__request ON public.contract(id__request);
    CREATE INDEX IF NOT EXISTS idx_contract_type ON public.contract(type);
    CREATE INDEX IF NOT EXISTS idx_contract_deleted_at ON public.contract(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_payment_contract_id ON public.payment(contract_id);
    CREATE INDEX IF NOT EXISTS idx_payment_payment_type ON public.payment(payment_type);
    CREATE INDEX IF NOT EXISTS idx_payment_payment_status ON public.payment(payment_status);
    CREATE INDEX IF NOT EXISTS idx_payment_deleted_at ON public.payment(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_request_deleted_at ON public.request(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_request_sr_status ON public.request(sr_status);
    CREATE INDEX IF NOT EXISTS idx_request_sr_created_date ON public.request(sr_created_date DESC);
  `).then(async () => {
    console.log('Auto-migration finished.');
    try {
      await migrateCompanyData();
    } catch (e) {
      console.error('Failed to run company data migration:', e);
    }
    try {
      await seedDefaultPermissions();
    } catch (e) {
      console.error('Failed to run default permissions seed:', e);
    }
    try {
      await cleanLegacyEmails();
    } catch (e) {
      console.error('Failed to run cleanLegacyEmails migration:', e);
    }
    try {
      await migrateEmptyEmployeeRoles();
    } catch (e) {
      console.error('Failed to run migrateEmptyEmployeeRoles migration:', e);
    }
    try {
      await migrateLegacyTaskPolicyElements();
    } catch (e) {
      console.error('Failed to run migrateLegacyTaskPolicyElements migration:', e);
    }
    try {
      await migrateTaskInfoComment();
    } catch (e) {
      console.error('Failed to run migrateTaskInfoComment migration:', e);
    }
    try {
      await migrateHeadManagerColumn();
    } catch (e) {
      console.error('Failed to run migrateHeadManagerColumn migration:', e);
    }
    try {
      await pool.query(`INSERT INTO public.app_migration_meta (key) VALUES ('schema_v1_completed') ON CONFLICT (key) DO NOTHING`);
    } catch (e) {}
  })
  .catch(err => {
    console.error('Migration error properties:');
    console.error('message:', err.message);
    console.error('detail:', err.detail);
    console.error('hint:', err.hint);
    console.error('where:', err.where);
    if (DEBUG_SQL) console.error('query:', err.query);
    console.error('stack:', err.stack);
  });
}

initDb();

async function cleanLegacyEmails() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting cleanLegacyEmails to replace email -> employee_id...');
    
    // Fetch all employees for mapping
    const empRes = await client.query('SELECT employee_id, email, username FROM employee');
    const employees = empRes.rows.filter(e => e.employee_id);
    
    if (employees.length === 0) {
      console.log('[Migration] No employee records found, skipping cleanLegacyEmails.');
      return;
    }

    await client.query('BEGIN');

    const resolveEmailOrUsername = (val) => {
      if (typeof val !== 'string' || !val.includes('@')) {
        return val;
      }
      const clean = val.trim().toLowerCase();
      const prefix = clean.split('@')[0];
      const match = employees.find(e => 
        (e.email && e.email.trim().toLowerCase() === clean) ||
        (e.username && e.username.trim().toLowerCase() === prefix) ||
        (e.email && e.email.trim().toLowerCase().split('@')[0] === prefix)
      );
      return match ? match.employee_id : val;
    };

    const resolveTextValue = (val) => {
      if (typeof val !== 'string') return val;
      if (val.includes(',')) {
        return val.split(',').map(item => resolveEmailOrUsername(item.trim())).join(',');
      }
      return resolveEmailOrUsername(val);
    };

    const resolveArray = (arr) => {
      if (!Array.isArray(arr)) return arr;
      return arr.map(item => resolveTextValue(item));
    };

    const resolveJson = (obj) => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'string') {
        return resolveTextValue(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(item => resolveJson(item));
      }
      if (typeof obj === 'object') {
        const newObj = {};
        for (const [k, v] of Object.entries(obj)) {
          newObj[k] = resolveJson(v);
        }
        return newObj;
      }
      return obj;
    };

    // 1. policy_and_program
    const papRes = await client.query(`
      SELECT policy_id, tier1_approval, tier2_approval, tier3_approval, policy_lead, sr_owner
      FROM policy_and_program
      WHERE tier1_approval LIKE '%@%'
         OR tier2_approval LIKE '%@%'
         OR tier3_approval LIKE '%@%'
         OR policy_lead LIKE '%@%'
         OR sr_owner LIKE '%@%'
    `);
    let papCount = 0;
    for (const row of papRes.rows) {
      const uTier1 = resolveTextValue(row.tier1_approval);
      const uTier2 = resolveTextValue(row.tier2_approval);
      const uTier3 = resolveTextValue(row.tier3_approval);
      const uLead = resolveTextValue(row.policy_lead);
      const uOwner = resolveTextValue(row.sr_owner);
      await client.query(`
        UPDATE policy_and_program
        SET tier1_approval = $1, tier2_approval = $2, tier3_approval = $3, policy_lead = $4, sr_owner = $5
        WHERE policy_id = $6
      `, [uTier1, uTier2, uTier3, uLead, uOwner, row.policy_id]);
      papCount++;
    }
    if (papCount > 0) {
      console.log(`[Migration] Updated policy_and_program: ${papCount} rows`);
    }

    // 2. comment
    const commentRes = await client.query(`
      SELECT comment_id, tag
      FROM comment
      WHERE tag LIKE '%@%'
    `);
    let commentCount = 0;
    for (const row of commentRes.rows) {
      const uTag = resolveTextValue(row.tag);
      await client.query(`
        UPDATE comment
        SET tag = $1
        WHERE comment_id = $2
      `, [uTag, row.comment_id]);
      commentCount++;
    }
    if (commentCount > 0) {
      console.log(`[Migration] Updated comment: ${commentCount} rows`);
    }

    // 3. request
    const requestRes = await client.query(`
      SELECT request_id, sr_creater, requester, policy_lead, sr_owner, approval_flow
      FROM request
      WHERE sr_creater LIKE '%@%'
         OR requester LIKE '%@%'
         OR policy_lead LIKE '%@%'
         OR array_to_string(sr_owner, ',') LIKE '%@%'
         OR approval_flow::text LIKE '%@%'
    `);
    let requestCount = 0;
    for (const row of requestRes.rows) {
      const uCreater = resolveTextValue(row.sr_creater);
      const uRequester = resolveTextValue(row.requester);
      const uLead = resolveTextValue(row.policy_lead);
      const uOwner = resolveArray(row.sr_owner);
      const uFlow = resolveJson(row.approval_flow);
      await client.query(`
        UPDATE request
        SET sr_creater = $1, requester = $2, policy_lead = $3, sr_owner = $4, approval_flow = $5
        WHERE request_id = $6
      `, [uCreater, uRequester, uLead, uOwner, uFlow, row.request_id]);
      requestCount++;
    }
    if (requestCount > 0) {
      console.log(`[Migration] Updated request: ${requestCount} rows`);
    }

    // 4. ticket
    const ticketRes = await client.query(`
      SELECT ticket_id, sr_creater, requester, policy_lead, sr_coordinator, processing_flow
      FROM ticket
      WHERE sr_creater LIKE '%@%'
         OR requester LIKE '%@%'
         OR policy_lead LIKE '%@%'
         OR array_to_string(sr_coordinator, ',') LIKE '%@%'
         OR processing_flow::text LIKE '%@%'
    `);
    let ticketCount = 0;
    for (const row of ticketRes.rows) {
      const uCreater = resolveTextValue(row.sr_creater);
      const uRequester = resolveTextValue(row.requester);
      const uLead = resolveTextValue(row.policy_lead);
      const uCoordinator = resolveArray(row.sr_coordinator);
      const uFlow = resolveJson(row.processing_flow);
      await client.query(`
        UPDATE ticket
        SET sr_creater = $1, requester = $2, policy_lead = $3, sr_coordinator = $4, processing_flow = $5
        WHERE ticket_id = $6
      `, [uCreater, uRequester, uLead, uCoordinator, uFlow, row.ticket_id]);
      ticketCount++;
    }
    if (ticketCount > 0) {
      console.log(`[Migration] Updated ticket: ${ticketCount} rows`);
    }

    // 5. ticket_comment
    const tcRes = await client.query(`
      SELECT comment_id, tag, comment_by
      FROM ticket_comment
      WHERE tag LIKE '%@%'
         OR comment_by LIKE '%@%'
    `);
    let tcCount = 0;
    for (const row of tcRes.rows) {
      const uTag = resolveTextValue(row.tag);
      const uCommentBy = resolveTextValue(row.comment_by);
      await client.query(`
        UPDATE ticket_comment
        SET tag = $1, comment_by = $2
        WHERE comment_id = $3
      `, [uTag, uCommentBy, row.comment_id]);
      tcCount++;
    }
    if (tcCount > 0) {
      console.log(`[Migration] Updated ticket_comment: ${tcCount} rows`);
    }

    // 6. ticket_type
    const ttRes = await client.query(`
      SELECT ticket_type_id, ticket_lead, sr_owner, coordinator, tier_1_engineer, tier_2_engineer, tier_3_engineer
      FROM ticket_type
      WHERE ticket_lead LIKE '%@%'
         OR sr_owner LIKE '%@%'
         OR coordinator LIKE '%@%'
         OR tier_1_engineer LIKE '%@%'
         OR tier_2_engineer LIKE '%@%'
         OR tier_3_engineer LIKE '%@%'
    `);
    let ttCount = 0;
    for (const row of ttRes.rows) {
      const uLead = resolveTextValue(row.ticket_lead);
      const uOwner = resolveTextValue(row.sr_owner);
      const uCoord = resolveTextValue(row.coordinator);
      const uT1 = resolveTextValue(row.tier_1_engineer);
      const uT2 = resolveTextValue(row.tier_2_engineer);
      const uT3 = resolveTextValue(row.tier_3_engineer);
      await client.query(`
        UPDATE ticket_type
        SET ticket_lead = $1, sr_owner = $2, coordinator = $3, tier_1_engineer = $4, tier_2_engineer = $5, tier_3_engineer = $6
        WHERE ticket_type_id = $7
      `, [uLead, uOwner, uCoord, uT1, uT2, uT3, row.ticket_type_id]);
      ttCount++;
    }
    if (ttCount > 0) {
      console.log(`[Migration] Updated ticket_type: ${ttCount} rows`);
    }

    await client.query('COMMIT');
    console.log('[Migration] Finished cleanLegacyEmails successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] Error in cleanLegacyEmails:', err);
  } finally {
    client.release();
  }
}

async function migrateEmptyEmployeeRoles() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting migrateEmptyEmployeeRoles...');
    const res = await client.query(`
      UPDATE employee
      SET role = 'staff'
      WHERE role IS NULL OR TRIM(role) = '';
    `);
    if (res.rowCount > 0) {
      console.log(`[Migration] Updated ${res.rowCount} employee records to role='staff'.`);
    } else {
      console.log('[Migration] No employee records with empty role found.');
    }
  } catch (e) {
    console.error('[Migration] Error in migrateEmptyEmployeeRoles:', e);
  } finally {
    client.release();
  }
}

async function migrateLegacyTaskPolicyElements() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting migrateLegacyTaskPolicyElements...');
    const res = await client.query(`
      UPDATE policy_and_program 
      SET elements = 'ASSIGN_TASK' 
      WHERE policy_id = '5969' AND (elements IS NULL OR elements = '' OR elements NOT LIKE '%ASSIGN_TASK%');
    `);
    if (res.rowCount > 0) {
      console.log(`[Migration] Updated ${res.rowCount} policy records with ASSIGN_TASK element.`);
    }
  } catch (e) {
    console.error('[Migration] Error in migrateLegacyTaskPolicyElements:', e);
  } finally {
    client.release();
  }
}

async function migrateCompanyData() {
  try {
    // 1. Fetch all my_company records ordered by their ID
    const myCompanies = await pool.query('SELECT my_company_id, company_shortname, company_fullname FROM "my_company" ORDER BY my_company_id');
    const myCompIds = myCompanies.rows.map(r => r.my_company_id);
    
    if (myCompIds.length === 0) {
      console.log('No my_company records found. Skipping company migration.');
      return;
    }

    console.log('Initializing empty my_company shortnames/fullnames to sequential names...');
    for (let i = 0; i < myCompanies.rows.length; i++) {
      const row = myCompanies.rows[i];
      if (!row.company_shortname || !row.company_fullname) {
        const targetShortname = row.company_shortname || `My Company ${i + 1}`;
        const targetFullname = row.company_fullname || `My Company Full Name ${i + 1}`;
        await pool.query(
          'UPDATE "my_company" SET company_shortname = $1, company_fullname = $2 WHERE my_company_id = $3',
          [targetShortname, targetFullname, row.my_company_id]
        );
      }
    }

    // 2. Fetch all accounts
    const accounts = await pool.query('SELECT account_id, company_entity FROM "account"');
    let updatedCount = 0;
    for (const account of accounts.rows) {
      const rawEntity = account.company_entity;
      
      // If it is already a valid my_company_id, leave it alone
      if (myCompIds.includes(rawEntity)) {
        continue;
      }

      // Map it to a valid my_company_id
      let targetId = myCompIds[0];
      if (rawEntity && (rawEntity.includes('Mock') || rawEntity.includes('Masked') || rawEntity.includes('Company') || rawEntity.includes('Entity'))) {
        const match = rawEntity.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          const idx = (num - 1) % myCompIds.length;
          targetId = myCompIds[idx >= 0 ? idx : 0];
        } else {
          targetId = myCompIds[updatedCount % myCompIds.length];
        }
      } else {
        targetId = myCompIds[updatedCount % myCompIds.length];
      }

      await pool.query('UPDATE "account" SET company_entity = $1 WHERE account_id = $2', [targetId, account.account_id]);
      updatedCount++;
    }
    console.log(`✅ Successfully migrated ${updatedCount} account records to valid my_company IDs.`);

    // Migrate operation_program records where company_id = '3' to '1'
    const opRes = await pool.query('UPDATE "operation_program" SET company_id = \'1\' WHERE company_id = \'3\'');
    console.log(`✅ Migrated ${opRes.rowCount} operation program records from company 3 to 1.`);
  } catch (err) {
    console.error('Failed to run company data migration:', err);
  }
}

async function seedDefaultPermissions() {
  // ── 1. exception_rules: seed ALL module/view names (no roles set) ──────────
  // Admin configures roles via UI. Empty row = visible to everyone by default.
  const ALL_VIEWS = [
    'my_company', 'department', 'employee', 'employee_active',
    'company', 'contact', 'policy', 'opportunity_list',
    'permissions', 'request', 'comment', 'payment',
    'invoice', 'mtr', 'operation_program', 'account', 'service',
    'asset', 'exception_rules', 'action_rules', 'my_location',
    'request_activity_log', 'logs', 'finance',
    'target_table', 'request_rating',
    // Virtual dashboard views
    'my_request', 'my_approval', 'my_process_owner', 'my_task', 'my_team',
    'cms_tenant_info', 'support', 'assigned_task', 'task_subtask',
  ];

  for (const name of ALL_VIEWS) {
    if (name === 'cms_tenant_info') {
      await pool.query(
        `INSERT INTO exception_rules (name, roles) VALUES ($1, 'Super Admin,Admin')
         ON CONFLICT (name) DO UPDATE SET roles = COALESCE(exception_rules.roles, 'Super Admin,Admin')`,
        [name]
      );
    } else if (name === 'assigned_task' || name === 'task_subtask') {
      await pool.query(
        `INSERT INTO exception_rules (name, roles) VALUES ($1, 'Super Admin,Admin,HR,Staff')
         ON CONFLICT (name) DO UPDATE SET roles = COALESCE(exception_rules.roles, 'Super Admin,Admin,HR,Staff')`,
        [name]
      );
    } else {
      await pool.query(
        `INSERT INTO exception_rules (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [name]
      );
    }
  }

  // ── 2. column_permissions: seed ALL columns from ALL public tables ──────────
  // No roles set — admin configures via UI. Empty = no column restriction.
  const EXCLUDED_TABLES = [
    'permission_levels', 'permission_positions', 'permission_roles',
    'permission_exceptions', 'column_permissions', 'exception_rules',
    'action_rules', 'customize', 'logs', 'pg_stat_statements',
  ];

  const placeholders = EXCLUDED_TABLES.map((_, i) => `$${i + 1}`).join(',');
  const colsRes = await pool.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name NOT IN (${placeholders})
     ORDER BY table_name, ordinal_position`,
    EXCLUDED_TABLES
  );

  for (const { table_name, column_name } of colsRes.rows) {
    await pool.query(
      `INSERT INTO column_permissions (table_name, column_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [table_name, column_name]
    );
  }

  // ── 3. Clean up obsolete columns from column_permissions ──────────────────
  await pool.query(
    `DELETE FROM column_permissions
     WHERE id IN (
       SELECT cp.id
       FROM column_permissions cp
       LEFT JOIN information_schema.columns c
         ON cp.table_name = c.table_name
         AND cp.column_name = c.column_name
         AND c.table_schema = current_schema()
       WHERE c.column_name IS NULL
         AND cp.table_name NOT IN (${placeholders})
     )`,
    EXCLUDED_TABLES
  );
}

async function migrateTaskInfoComment() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Checking and adding task_info_comment column to assigned_task...');
    await client.query(`
      ALTER TABLE assigned_task 
      ADD COLUMN IF NOT EXISTS task_info_comment TEXT;
    `);
    console.log('[Migration] task_info_comment column check/addition complete.');
  } catch (err) {
    console.error('Failed to run migrateTaskInfoComment:', err);
  } finally {
    client.release();
  }
}

async function migrateHeadManagerColumn() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Checking and adding head_manager column to employee...');
    await client.query(`
      ALTER TABLE public.employee ADD COLUMN IF NOT EXISTS head_manager character varying(50);
    `);
    // Drop old constraint if exists, then re-add
    await client.query(`
      ALTER TABLE public.employee DROP CONSTRAINT IF EXISTS employee_head_manager_fkey;
    `);
    await client.query(`
      ALTER TABLE public.employee ADD CONSTRAINT employee_head_manager_fkey
        FOREIGN KEY (head_manager) REFERENCES employee(employee_id) ON DELETE SET NULL;
    `);
    console.log('[Migration] head_manager column check/addition complete.');
  } catch (err) {
    console.error('Failed to run migrateHeadManagerColumn:', err);
  } finally {
    client.release();
  }
}

async function migrateFinanceView() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Dropping finance_logs table, ensuring v_finance view and permissions...');
    await client.query(`
      DROP TABLE IF EXISTS public.finance_logs CASCADE;
      DROP VIEW IF EXISTS public.v_finance CASCADE;
      CREATE OR REPLACE VIEW public.v_finance AS
      WITH contract_agg AS (
        SELECT 
          COALESCE(c.request, c.id__request) AS request_id,
          COUNT(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' THEN 1 END) AS selling_contract_count,
          SUM(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' 
              THEN COALESCE(c.total_value_in_base_currency, c.total_value * COALESCE(c.exchance_rate, 1.0), COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) + COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0)) 
              ELSE 0 END) AS selling,
          SUM(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' 
              THEN COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0) 
              ELSE 0 END) AS vat_selling,
          SUM(CASE WHEN c.type = 69 OR c.type::text = '69' OR LOWER(c.type::text) LIKE '%sell%' OR LOWER(c.type::text) LIKE '%bán%' 
              THEN COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) 
              ELSE 0 END) AS selling_wo_vat,
          COUNT(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' THEN 1 END) AS buying_contract_count,
          SUM(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' 
              THEN COALESCE(c.total_value_in_base_currency, c.total_value * COALESCE(c.exchance_rate, 1.0), COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) + COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0)) 
              ELSE 0 END) AS buying,
          SUM(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' 
              THEN COALESCE(c.vat_value_in_base_currency, c.vat_value * COALESCE(c.exchance_rate, 1.0), 0) 
              ELSE 0 END) AS vat_buying,
          SUM(CASE WHEN c.type = 70 OR c.type::text = '70' OR LOWER(c.type::text) LIKE '%buy%' OR LOWER(c.type::text) LIKE '%mua%' 
              THEN COALESCE(c.value_before_vat_in_base_currency, c.value_before_vat * COALESCE(c.exchance_rate, 1.0), 0) 
              ELSE 0 END) AS buying_wo_vat
        FROM contract c
        WHERE c.deleted_at IS NULL AND COALESCE(c.request, c.id__request) IS NOT NULL
        GROUP BY COALESCE(c.request, c.id__request)
      ),
      payment_agg AS (
        SELECT
          COALESCE(p.request, c.request, c.id__request) AS request_id,
          COUNT(CASE WHEN (c.type = 69 OR p.payment_type = 60) THEN 1 END) AS incoming_pm_count,
          SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_payment,
          SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) AND (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_payment_paid,
          SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NOT NULL AND p.due_date::date > CURRENT_DATE) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_pm_not_due_yet,
          SUM(CASE WHEN (c.type = 69 OR p.payment_type = 60) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NULL OR p.due_date::date <= CURRENT_DATE) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS incoming_pm_pending_pm,
          COUNT(CASE WHEN (c.type = 70 OR p.payment_type = 61) THEN 1 END) AS outgoing_pm_count,
          SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_payment,
          SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) AND (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_payment_paid,
          SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NOT NULL AND p.due_date::date > CURRENT_DATE) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_pm_not_due_yet,
          SUM(CASE WHEN (c.type = 70 OR p.payment_type = 61) AND NOT (p.payment_status = 32 OR LOWER(p.payment_status::text) = 'paid') AND (p.due_date IS NULL OR p.due_date::date <= CURRENT_DATE) 
              THEN COALESCE(p.value_in_base_currency, p.value * COALESCE(p.exchange_rate, 1.0), 0) ELSE 0 END) AS outgoing_pm_pending_pm
        FROM payment p
        LEFT JOIN contract c ON p.contract_id = c.contract_id
        WHERE p.deleted_at IS NULL AND COALESCE(p.request, c.request, c.id__request) IS NOT NULL
        GROUP BY COALESCE(p.request, c.request, c.id__request)
      ),
      invoice_agg AS (
        SELECT
          COALESCE(i.request, c.request, c.id__request) AS request_id,
          COUNT(CASE WHEN (c.type = 69 OR i.invoice_type = '71' OR LOWER(i.invoice_type::text) = 'selling') THEN 1 END) AS selling_invoice_count,
          SUM(CASE WHEN (c.type = 69 OR i.invoice_type = '71' OR LOWER(i.invoice_type::text) = 'selling') 
              THEN COALESCE(i.total_value_in_base_currency, i.total_value * COALESCE(i.exchange_rate, 1.0), 0) ELSE 0 END) AS selling_invoice_total_value,
          COUNT(CASE WHEN (c.type = 70 OR i.invoice_type = '72' OR LOWER(i.invoice_type::text) = 'buying') THEN 1 END) AS buying_invoice_count,
          SUM(CASE WHEN (c.type = 70 OR i.invoice_type = '72' OR LOWER(i.invoice_type::text) = 'buying') 
              THEN COALESCE(i.total_value_in_base_currency, i.total_value * COALESCE(i.exchange_rate, 1.0), 0) ELSE 0 END) AS buying_invoice_total_value
        FROM invoice i
        LEFT JOIN contract c ON i.contract_id = c.contract_id
        WHERE i.deleted_at IS NULL AND COALESCE(i.request, c.request, c.id__request) IS NOT NULL
        GROUP BY COALESCE(i.request, c.request, c.id__request)
      ),
      expense_agg AS (
        SELECT
          e.id__request AS request_id,
          SUM(CASE WHEN e.id__expense_type = 106 OR LOWER(e.id__expense_type::text) = 'expense' 
              THEN COALESCE(e.total_value_in_base_currency, e.total_value * COALESCE(e.exchange_rate, 1.0), COALESCE(e.value_before_vat, 0) * COALESCE(e.exchange_rate, 1.0), 0) 
              ELSE COALESCE(e.total_value_in_base_currency, e.total_value * COALESCE(e.exchange_rate, 1.0), COALESCE(e.value_before_vat, 0) * COALESCE(e.exchange_rate, 1.0), 0) END) AS expense,
          SUM(CASE WHEN e.id__expense_type = 107 OR LOWER(e.id__expense_type::text) = 'non expense' 
              THEN COALESCE(e.total_value_in_base_currency, e.total_value * COALESCE(e.exchange_rate, 1.0), COALESCE(e.value_before_vat, 0) * COALESCE(e.exchange_rate, 1.0), 0) 
              ELSE 0 END) AS non_expense,
          MAX(e.fy) AS exp_fy
        FROM expense e
        WHERE e.deleted_at IS NULL AND e.id__request IS NOT NULL
        GROUP BY e.id__request
      ),
      asset_agg AS (
        SELECT
          a.request AS request_id,
          SUM(COALESCE(
            a.value_in_base_currency,
            COALESCE(NULLIF(regexp_replace(a.purchase_cost, '[^0-9.]', '', 'g'), '')::numeric, 0) * COALESCE(NULLIF(regexp_replace(a.exchange_rate, '[^0-9.]', '', 'g'), '')::numeric, 1.0)
          )) AS asset
        FROM asset a
        WHERE a.deleted_at IS NULL AND a.request IS NOT NULL
        GROUP BY a.request
      ),
      request_financials AS (
        SELECT 
          r.request_id,
          r.request_type,
          (CASE 
            WHEN ea.exp_fy IS NOT NULL AND ea.exp_fy <> '' THEN 
              (CASE WHEN ea.exp_fy LIKE 'FY%' THEN ea.exp_fy ELSE 'FY' || ea.exp_fy END)
            ELSE 'FY' || EXTRACT(YEAR FROM COALESCE(r.sr_submitted_date, r.sr_created_date, CURRENT_TIMESTAMP))::text 
          END) AS fy,
          COALESCE(ca.selling_contract_count, 0) AS selling_contract_count,
          COALESCE(ca.selling, 0) AS selling,
          COALESCE(ca.vat_selling, 0) AS vat_selling,
          COALESCE(ca.selling_wo_vat, 0) AS selling_wo_vat,
          COALESCE(ca.buying_contract_count, 0) AS buying_contract_count,
          COALESCE(ca.buying, 0) AS buying,
          COALESCE(ca.vat_buying, 0) AS vat_buying,
          COALESCE(ca.buying_wo_vat, 0) AS buying_wo_vat,
          COALESCE(pa.incoming_pm_count, 0) AS incoming_pm_count,
          COALESCE(pa.incoming_payment, 0) AS incoming_payment,
          COALESCE(pa.incoming_payment_paid, 0) AS incoming_payment_paid,
          COALESCE(pa.incoming_pm_not_due_yet, 0) AS incoming_pm_not_due_yet,
          COALESCE(pa.incoming_pm_pending_pm, 0) AS incoming_pm_pending_pm,
          COALESCE(pa.outgoing_pm_count, 0) AS outgoing_pm_count,
          COALESCE(pa.outgoing_payment, 0) AS outgoing_payment,
          COALESCE(pa.outgoing_payment_paid, 0) AS outgoing_payment_paid,
          COALESCE(pa.outgoing_pm_not_due_yet, 0) AS outgoing_pm_not_due_yet,
          COALESCE(pa.outgoing_pm_pending_pm, 0) AS outgoing_pm_pending_pm,
          COALESCE(ia.selling_invoice_count, 0) AS selling_invoice_count,
          COALESCE(ia.selling_invoice_total_value, 0) AS selling_invoice_total_value,
          COALESCE(ia.buying_invoice_count, 0) AS buying_invoice_count,
          COALESCE(ia.buying_invoice_total_value, 0) AS buying_invoice_total_value,
          COALESCE(ea.expense, 0) AS expense,
          COALESCE(ea.non_expense, 0) AS non_expense,
          COALESCE(aa.asset, 0) AS asset
        FROM request r
        LEFT JOIN contract_agg ca ON r.request_id = ca.request_id
        LEFT JOIN payment_agg pa ON r.request_id = pa.request_id
        LEFT JOIN invoice_agg ia ON r.request_id = ia.request_id
        LEFT JOIN expense_agg ea ON r.request_id = ea.request_id
        LEFT JOIN asset_agg aa ON r.request_id = aa.request_id
        WHERE r.deleted_at IS NULL
      ),
      process_summary AS (
        SELECT
          rf.request_type AS process_id,
          rf.fy,
          COUNT(rf.request_id) AS total_requests,
          SUM(rf.selling_contract_count) AS selling_contract_count,
          SUM(rf.selling) AS selling,
          SUM(rf.vat_selling) AS vat_selling,
          SUM(rf.selling_wo_vat) AS selling_wo_vat,
          SUM(rf.buying_contract_count) AS buying_contract_count,
          SUM(rf.buying) AS buying,
          SUM(rf.vat_buying) AS vat_buying,
          SUM(rf.buying_wo_vat) AS buying_wo_vat,
          (SUM(rf.selling) - SUM(rf.buying)) AS gm,
          (SUM(rf.selling_wo_vat) - SUM(rf.buying_wo_vat)) AS gm_wo_vat,
          SUM(rf.incoming_pm_count) AS incoming_pm_count,
          SUM(rf.incoming_payment) AS incoming_payment,
          SUM(rf.incoming_payment_paid) AS incoming_payment_paid,
          SUM(rf.incoming_pm_not_due_yet) AS incoming_pm_not_due_yet,
          SUM(rf.incoming_pm_pending_pm) AS incoming_pm_pending_pm,
          SUM(rf.outgoing_pm_count) AS outgoing_pm_count,
          SUM(rf.outgoing_payment) AS outgoing_payment,
          SUM(rf.outgoing_payment_paid) AS outgoing_payment_paid,
          SUM(rf.outgoing_pm_not_due_yet) AS outgoing_pm_not_due_yet,
          SUM(rf.outgoing_pm_pending_pm) AS outgoing_pm_pending_pm,
          SUM(rf.selling_invoice_count) AS selling_invoice_count,
          SUM(rf.selling_invoice_total_value) AS selling_invoice_total_value,
          SUM(rf.buying_invoice_count) AS buying_invoice_count,
          SUM(rf.buying_invoice_total_value) AS buying_invoice_total_value,
          SUM(rf.expense) AS expense,
          SUM(rf.non_expense) AS non_expense,
          SUM(rf.asset) AS asset
        FROM request_financials rf
        WHERE (
          rf.selling <> 0 OR rf.buying <> 0 OR rf.incoming_payment <> 0 OR 
          rf.outgoing_payment <> 0 OR rf.expense <> 0 OR rf.non_expense <> 0 OR rf.asset <> 0
        )
        GROUP BY rf.request_type, rf.fy
      )
      SELECT 
        (p.policy_id || '__' || COALESCE(ps.fy, 'N/A')) AS id,
        p.policy_id AS process_id,
        p.policy_name AS process,
        p.policy_type,
        p.description,
        p.policy_lead,
        COALESCE(mc.country, '') AS country,
        p.company_id,
        COALESCE(ps.fy, '') AS fy,
        COALESCE(ps.selling_contract_count, 0) AS selling_contract_count,
        COALESCE(ps.selling, 0) AS selling,
        COALESCE(ps.buying_contract_count, 0) AS buying_contract_count,
        COALESCE(ps.buying, 0) AS buying,
        COALESCE(ps.gm, 0) AS gm,
        COALESCE(ps.vat_selling, 0) AS vat_selling,
        COALESCE(ps.selling_wo_vat, 0) AS selling_wo_vat,
        COALESCE(ps.vat_buying, 0) AS vat_buying,
        COALESCE(ps.buying_wo_vat, 0) AS buying_wo_vat,
        COALESCE(ps.gm_wo_vat, 0) AS gm_wo_vat,
        COALESCE(ps.incoming_pm_count, 0) AS incoming_pm_count,
        COALESCE(ps.incoming_payment, 0) AS incoming_payment,
        COALESCE(ps.incoming_payment_paid, 0) AS incoming_payment_paid,
        COALESCE(ps.incoming_pm_not_due_yet, 0) AS incoming_pm_not_due_yet,
        COALESCE(ps.incoming_pm_pending_pm, 0) AS incoming_pm_pending_pm,
        COALESCE(ps.outgoing_pm_count, 0) AS outgoing_pm_count,
        COALESCE(ps.outgoing_payment, 0) AS outgoing_payment,
        COALESCE(ps.outgoing_payment_paid, 0) AS outgoing_payment_paid,
        COALESCE(ps.outgoing_pm_not_due_yet, 0) AS outgoing_pm_not_due_yet,
        COALESCE(ps.outgoing_pm_pending_pm, 0) AS outgoing_pm_pending_pm,
        COALESCE(ps.selling_invoice_count, 0) AS selling_invoice_count,
        COALESCE(ps.selling_invoice_total_value, 0) AS selling_invoice_total_value,
        COALESCE(ps.buying_invoice_count, 0) AS buying_invoice_count,
        COALESCE(ps.buying_invoice_total_value, 0) AS buying_invoice_total_value,
        COALESCE(ps.expense, 0) AS expense,
        COALESCE(ps.non_expense, 0) AS non_expense,
        COALESCE(ps.asset, 0) AS asset,
        COALESCE(ps.total_requests, 0) AS total_requests
      FROM policy_and_program p
      LEFT JOIN my_company mc ON p.company_id = mc.my_company_id
      JOIN process_summary ps ON p.policy_id::text = ps.process_id::text OR p.policy_name = ps.process_id::text
      WHERE p.deleted_at IS NULL;

      INSERT INTO column_permissions (table_name, column_name)
      SELECT 'finance', col FROM unnest(ARRAY[
        'process', 'policy_type', 'selling_contract_count', 'selling', 'buying_contract_count', 'buying',
        'gm', 'vat_selling', 'selling_wo_vat', 'vat_buying', 'buying_wo_vat', 'gm_wo_vat',
        'incoming_pm_count', 'incoming_payment', 'incoming_payment_paid', 'incoming_pm_not_due_yet', 'incoming_pm_pending_pm',
        'outgoing_pm_count', 'outgoing_payment', 'outgoing_payment_paid', 'outgoing_pm_not_due_yet', 'outgoing_pm_pending_pm',
        'selling_invoice_count', 'selling_invoice_total_value', 'buying_invoice_count', 'buying_invoice_total_value',
        'expense', 'non_expense', 'asset', 'fy'
      ]) AS col
      ON CONFLICT DO NOTHING;
    `);
    console.log('[Migration] Finance view and permissions verified and finance_logs table removed.');
  } catch (err) {
    console.error('[Migration] Failed to run migrateFinanceView:', err);
  } finally {
    client.release();
  }
}

async function dropDeprecatedFinanceColumns() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Dropping deprecated columns and legacy physical finance table...');
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'expense' AND column_name = 'id__finance_category') THEN
          ALTER TABLE public.expense DROP COLUMN IF EXISTS id__finance_category;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contract' AND column_name = 'operation_program_id') THEN
          ALTER TABLE public.contract DROP COLUMN IF EXISTS operation_program_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoice' AND column_name = 'operation_program_id') THEN
          ALTER TABLE public.invoice DROP COLUMN IF EXISTS operation_program_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment' AND column_name = 'operation_program_id') THEN
          ALTER TABLE public.payment DROP COLUMN IF EXISTS operation_program_id;
        END IF;
        DELETE FROM public.column_permissions WHERE column_name IN ('id__finance_category', 'operation_program_id');
        DELETE FROM public.operation_program;
        DELETE FROM public.action_rules WHERE view_name = 'operation_program' OR action_id LIKE '%operation_program%';
        DROP TABLE IF EXISTS public.finance CASCADE;
        DROP TABLE IF EXISTS public.finance_logs CASCADE;
      END $$;
    `);
    console.log('[Migration] Deprecated columns and legacy finance table cleaned up successfully.');
  } catch (err) {
    console.error('[Migration] Failed to run dropDeprecatedFinanceColumns:', err);
  } finally {
    client.release();
  }
}

async function runIncrementalMigrations() {
  try {
    await dropDeprecatedFinanceColumns();
  } catch (e) {
    console.error('Failed to run dropDeprecatedFinanceColumns migration:', e);
  }
  try {
    await migrateFinanceView();
  } catch (e) {
    console.error('Failed to run migrateFinanceView migration:', e);
  }
  try {
    await migrateTaskInfoComment();
  } catch (e) {
    console.error('Failed to run migrateTaskInfoComment migration:', e);
  }
  try {
    await migrateHeadManagerColumn();
  } catch (e) {
    console.error('Failed to run migrateHeadManagerColumn migration:', e);
  }
  try {
    await migrateLegacyTaskPolicyElements();
  } catch (e) {
    console.error('Failed to run migrateLegacyTaskPolicyElements migration:', e);
  }
  try {
    await migratePerformanceIndexes();
  } catch (e) {
    console.error('Failed to run migratePerformanceIndexes migration:', e);
  }
  try {
    await ensureExpenseSequence();
  } catch (e) {
    console.error('Failed to run ensureExpenseSequence migration:', e);
  }
  try {
    await migrateBaseCurrencyColumns();
  } catch (e) {
    console.error('Failed to run migrateBaseCurrencyColumns migration:', e);
  }
  try {
    await migrateStatusCatalogAndTypes();
  } catch (e) {
    console.error('Failed to run migrateStatusCatalogAndTypes migration:', e);
  }
  try {
    await migrateAuditLogTrigger();
  } catch (e) {
    console.error('Failed to run migrateAuditLogTrigger migration:', e);
  }
  try {
    await ensureActionRulesSeed();
  } catch (e) {
    console.error('Failed to run ensureActionRulesSeed migration:', e);
  }
  try {
    await cleanupPolicyMultiSelectBrackets();
  } catch (e) {
    console.error('Failed to run cleanupPolicyMultiSelectBrackets migration:', e);
  }
  try {
    await migrateUtc0Standardization();
  } catch (e) {
    console.error('Failed to run migrateUtc0Standardization migration:', e);
  }
}

async function migrateUtc0Standardization() {
  const fs = require('fs');
  const path = require('path');
  const migrationFile = path.join(__dirname, '..', 'migrations', '2026-09-18_utc0_standardization.sql');
  if (fs.existsSync(migrationFile)) {
    const sql = fs.readFileSync(migrationFile, 'utf8');
    await pool.query(sql);
    console.log('[Migration] 2026-09-18_utc0_standardization applied successfully.');
  }
}

async function cleanupPolicyMultiSelectBrackets() {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE policy_and_program
      SET sr_owner = TRIM(BOTH ', ' FROM regexp_replace(replace(replace(sr_owner, '[', ''), ']', ''), '\\s*,\\s*', ', ', 'g'))
      WHERE sr_owner LIKE '%[%' OR sr_owner LIKE '%]%';
    `);
    await client.query(`
      UPDATE policy_and_program
      SET elements = TRIM(BOTH ', ' FROM regexp_replace(replace(replace(elements, '[', ''), ']', ''), '\\s*,\\s*', ', ', 'g'))
      WHERE elements LIKE '%[%' OR elements LIKE '%]%';
    `);
  } catch (err) {
    console.error('cleanupPolicyMultiSelectBrackets error:', err.message);
  } finally {
    client.release();
  }
}

async function ensureActionRulesSeed() {
  const client = await pool.connect();
  try {
    // 1. Ensure ACT-REQUEST-016 contains my_process_owner
    await client.query(`
      INSERT INTO action_rules (action_id, view_name, roles, display_name, description)
      VALUES ('ACT-REQUEST-016', 'my_request,my_process_owner,my_task,my_team,my_approval,request', '[sr_creater],[requester],[sr_owner],[policy_lead]', 'View Main Request', 'Chuyển hướng xem chi tiết yêu cầu gốc. Điều kiện hiển thị: Request ID có chứa ký tự ''-'' VÀ có ít nhất 1 liên kết payment hoặc invoice.')
      ON CONFLICT (action_id) DO UPDATE SET
        view_name = EXCLUDED.view_name,
        roles = EXCLUDED.roles,
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description;
    `);

    // 2. Ensure ACT-REQUEST-02, 03, 03-RE, 04, 05, 07, 08 contain my_process_owner
    await client.query(`
      UPDATE action_rules
      SET view_name = 'my_process_owner,my_task,my_team'
      WHERE action_id = 'ACT-REQUEST-02';

      UPDATE action_rules
      SET view_name = 'my_request,my_approval,my_process_owner,my_task,my_team'
      WHERE action_id IN ('ACT-REQUEST-03', 'ACT-REQUEST-03-RE');

      UPDATE action_rules
      SET view_name = 'my_process_owner,my_task,my_team'
      WHERE action_id IN ('ACT-REQUEST-04', 'ACT-REQUEST-05', 'ACT-REQUEST-07', 'ACT-REQUEST-08');

      -- Comprehensive sync: for any remaining action_rules containing my_task, ensure my_process_owner is also present
      UPDATE action_rules
      SET view_name = view_name || ',my_process_owner'
      WHERE view_name LIKE '%my_task%' AND view_name NOT LIKE '%my_process_owner%';

      -- Ensure CRUD action rules for my_process_owner exist
      INSERT INTO action_rules (action_id, view_name, roles, display_name, description, display)
      VALUES
        ('add_my_process_owner',   'my_process_owner', NULL, 'Add Request (My Process Owner)',   'Add request from My Process Owner view',    true),
        ('edit_my_process_owner',  'my_process_owner', NULL, 'Edit Request (My Process Owner)',  'Edit request in My Process Owner view',     true),
        ('delete_my_process_owner','my_process_owner', NULL, 'Delete Request (My Process Owner)','Delete request in My Process Owner view', true)
      ON CONFLICT (action_id) DO UPDATE SET
        view_name = EXCLUDED.view_name,
        display = true;

      -- Sync exception_rules so my_task does not block users who have access to my_process_owner
      UPDATE exception_rules
      SET roles = '[Staff]'
      WHERE name = 'my_task' AND (roles = '[Super Admin]' OR roles IS NULL);
    `);
  } finally {
    client.release();
  }
}

async function migrateAuditLogTrigger() {
  const client = await pool.connect();
  try {
    const triggerSQL = `
      CREATE OR REPLACE FUNCTION audit_log_trigger()
      RETURNS TRIGGER AS $$
      DECLARE
          v_pk_col TEXT;
          v_record_id TEXT;
          v_action TEXT;
          user_val TEXT;
          changed_fields JSONB;
      BEGIN
          SELECT a.attname INTO v_pk_col
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = TG_RELID AND i.indisprimary
          LIMIT 1;

          IF v_pk_col IS NULL THEN
              v_pk_col := 'id';
          END IF;

          IF (TG_OP = 'DELETE') THEN
              v_record_id := COALESCE(to_jsonb(OLD) ->> v_pk_col, 'unknown');
          ELSE
              v_record_id := COALESCE(to_jsonb(NEW) ->> v_pk_col, 'unknown');
          END IF;

          BEGIN
              user_val := current_setting('app.current_user', true);
          EXCEPTION WHEN OTHERS THEN
              user_val := NULL;
          END;

          IF user_val IS NULL OR user_val = '' THEN
              IF (TG_OP = 'DELETE') THEN
                  user_val := COALESCE(
                      to_jsonb(OLD) ->> 'updated_by',
                      to_jsonb(OLD) ->> 'created_by',
                      to_jsonb(OLD) ->> 'comment_by',
                      'system'
                  );
              ELSE
                  user_val := COALESCE(
                      to_jsonb(NEW) ->> 'updated_by',
                      to_jsonb(NEW) ->> 'created_by',
                      to_jsonb(NEW) ->> 'comment_by',
                      'system'
                  );
              END IF;
          END IF;

          IF (TG_OP = 'INSERT') THEN
              v_action := 'created record';
              
              SELECT jsonb_object_agg(key, jsonb_build_object('old', null, 'new', value)) INTO changed_fields
              FROM jsonb_each(to_jsonb(NEW))
              WHERE key NOT IN ('log', 'logs', 'notification_logs', 'updated_date', 'updated_by', 'created_date', 'created_by') AND value IS NOT NULL;

              IF changed_fields IS NOT NULL AND changed_fields != '{}'::jsonb THEN
                  INSERT INTO audit_logs (table_name, record_id, action, changes, changed_by)
                  VALUES (TG_TABLE_NAME, v_record_id, v_action, changed_fields, user_val);
              END IF;

          ELSIF (TG_OP = 'UPDATE') THEN
              v_action := 'updated record';

              SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val)) INTO changed_fields
              FROM (
                  SELECT o.key, o.value as old_val, n.value as new_val
                  FROM jsonb_each(to_jsonb(OLD)) o
                  JOIN jsonb_each(to_jsonb(NEW)) n ON o.key = n.key
                  WHERE o.value IS DISTINCT FROM n.value
                    AND o.key NOT IN ('log', 'logs', 'notification_logs', 'updated_date', 'updated_by', 'created_date', 'created_by')
              ) t;

              IF changed_fields IS NOT NULL AND changed_fields != '{}'::jsonb THEN
                  INSERT INTO audit_logs (table_name, record_id, action, changes, changed_by)
                  VALUES (TG_TABLE_NAME, v_record_id, v_action, changed_fields, user_val);
              END IF;

          ELSIF (TG_OP = 'DELETE') THEN
              v_action := 'deleted record';
              
              INSERT INTO audit_logs (table_name, record_id, action, changes, changed_by)
              VALUES (TG_TABLE_NAME, v_record_id, v_action, to_jsonb(OLD), user_val);
              
              RETURN OLD;
          END IF;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await client.query(triggerSQL);

    // Clean up bogus notification_logs entries in audit_logs
    await client.query(`
      DELETE FROM audit_logs 
      WHERE action = 'updated record' 
        AND changes ? 'notification_logs'
        AND (
          SELECT count(*) FROM jsonb_object_keys(changes) k WHERE k != 'notification_logs'
        ) = 0
    `);
    await client.query(`
      ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS updated_by varchar(255);
      ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS updated_by varchar(255);
      ALTER TABLE "contract" ADD COLUMN IF NOT EXISTS updated_by varchar(255);
      ALTER TABLE "expense" ADD COLUMN IF NOT EXISTS updated_by varchar(255);
      ALTER TABLE "asset" ADD COLUMN IF NOT EXISTS updated_by varchar(255);
      ALTER TABLE "service" ADD COLUMN IF NOT EXISTS updated_by varchar(255);
    `);
    console.log('[Migration] audit_log_trigger verified and bogus notification_logs purged.');
  } finally {
    client.release();
  }
}

async function migratePerformanceIndexes() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- 1. Functional indexes on employee to eliminate sequential scans in joins & filters
      CREATE INDEX IF NOT EXISTS idx_employee_lower_employee_id ON public.employee (LOWER(employee_id));
      CREATE INDEX IF NOT EXISTS idx_employee_lower_username ON public.employee (LOWER(username));
      CREATE INDEX IF NOT EXISTS idx_employee_lower_full_name ON public.employee (LOWER(full_name));

      -- 2. Audit logs indexes for faceted summaries and search
      CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs (table_name);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON public.audit_logs (created_at DESC);

      -- 3. MTR indexes for account balance aggregations and dates
      CREATE INDEX IF NOT EXISTS idx_mtr_account_type ON public.mtr (account, transaction_type);
      CREATE INDEX IF NOT EXISTS idx_mtr_account_date ON public.mtr (account, transaction_date DESC NULLS LAST);

      -- 4. Policy and program indexes for fast lookup and join
      CREATE INDEX IF NOT EXISTS idx_policy_name_lower ON public.policy_and_program (LOWER(policy_name));
      CREATE INDEX IF NOT EXISTS idx_policy_id_text ON public.policy_and_program ((policy_id::text));
    `);
    console.log('[Migration] Performance indexes verified and applied successfully.');
  } catch (err) {
    console.error('[Migration] Failed to create performance indexes:', err.message);
  } finally {
    client.release();
  }
}

async function ensureExpenseSequence() {
  const client = await pool.connect();
  try {
    const maxRes = await client.query(`SELECT COALESCE(MAX(id), 0) as max_id FROM expense`);
    const maxId = Number(maxRes.rows[0].max_id);
    await client.query(`CREATE SEQUENCE IF NOT EXISTS expense_id_seq`);
    await client.query(`SELECT setval('expense_id_seq', GREATEST($1::bigint, 1))`, [maxId]);
    await client.query(`ALTER TABLE expense ALTER COLUMN id SET DEFAULT nextval('expense_id_seq')`);
    console.log('[Migration] expense_id_seq verified and attached to expense.id');
  } catch (err) {
    console.error('[Migration] Failed to ensure expense_id_seq:', err.message);
  } finally {
    client.release();
  }
}

async function migrateBaseCurrencyColumns() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Ensuring Base Currency columns across payment, asset, expense, contract, and invoice...');
    
    // 1. Payment
    await client.query(`
      ALTER TABLE public.payment ADD COLUMN IF NOT EXISTS value_in_base_currency numeric;
      UPDATE public.payment 
      SET value_in_base_currency = ROUND(COALESCE(value, 0) * COALESCE(exchange_rate, 1))
      WHERE value_in_base_currency IS NULL;
    `);

    // 2. Asset
    await client.query(`
      ALTER TABLE public.asset ADD COLUMN IF NOT EXISTS value_in_base_currency numeric;
      UPDATE public.asset 
      SET value_in_base_currency = ROUND(COALESCE(NULLIF(regexp_replace(purchase_cost, '[^0-9.]', '', 'g'), '')::numeric, 0) * COALESCE(NULLIF(regexp_replace(exchange_rate, '[^0-9.]', '', 'g'), '')::numeric, 1))
      WHERE value_in_base_currency IS NULL;
    `);

    // 3. Expense
    await client.query(`
      ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS total_value numeric;
      ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS value_before_vat_in_base_currency numeric;
      ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS vat_value_in_base_currency numeric;
      ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS total_value_in_base_currency numeric;
      UPDATE public.expense 
      SET total_value = COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0),
          value_before_vat_in_base_currency = ROUND(COALESCE(value_before_vat, 0) * COALESCE(exchange_rate, 1)),
          vat_value_in_base_currency = ROUND(COALESCE(vat_value, 0) * COALESCE(exchange_rate, 1)),
          total_value_in_base_currency = ROUND((COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) * COALESCE(exchange_rate, 1))
      WHERE total_value IS NULL OR total_value_in_base_currency IS NULL;
    `);

    // 4. Contract
    await client.query(`
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS total_value numeric;
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS value_before_vat_in_base_currency numeric;
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS vat_value_in_base_currency numeric;
      ALTER TABLE public.contract ADD COLUMN IF NOT EXISTS total_value_in_base_currency numeric;
      UPDATE public.contract 
      SET total_value = COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0),
          value_before_vat_in_base_currency = ROUND(COALESCE(value_before_vat, 0) * COALESCE(exchance_rate, 1)),
          vat_value_in_base_currency = ROUND(COALESCE(vat_value, 0) * COALESCE(exchance_rate, 1)),
          total_value_in_base_currency = ROUND((COALESCE(value_before_vat, 0) + COALESCE(vat_value, 0)) * COALESCE(exchance_rate, 1))
      WHERE total_value IS NULL OR total_value_in_base_currency IS NULL;
    `);

    // 5. Invoice
    await client.query(`
      ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS total_value numeric;
      ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS value_before_vat_in_base_currency numeric;
      ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS vat_value_in_base_currency numeric;
      ALTER TABLE public.invoice ADD COLUMN IF NOT EXISTS total_value_in_base_currency numeric;
      UPDATE public.invoice 
      SET total_value = COALESCE(total_value, (COALESCE(value_before_vat, 0) + COALESCE(NULLIF(regexp_replace(vat_value::text, '[^0-9.]', '', 'g'), '')::numeric, 0))),
          value_before_vat_in_base_currency = COALESCE(value_before_vat_in_base_currency, ROUND(COALESCE(value_before_vat, 0) * COALESCE(exchange_rate, 1))),
          vat_value_in_base_currency = COALESCE(vat_value_in_base_currency, ROUND(COALESCE(NULLIF(regexp_replace(vat_value::text, '[^0-9.]', '', 'g'), '')::numeric, 0) * COALESCE(exchange_rate, 1))),
          total_value_in_base_currency = COALESCE(total_value_in_base_currency, ROUND((COALESCE(value_before_vat, 0) + COALESCE(NULLIF(regexp_replace(vat_value::text, '[^0-9.]', '', 'g'), '')::numeric, 0)) * COALESCE(exchange_rate, 1)))
      WHERE value_before_vat_in_base_currency IS NULL OR total_value_in_base_currency IS NULL;

      -- 6. Clean up any deprecated _in_vnd columns completely
      ALTER TABLE public.invoice DROP COLUMN IF EXISTS value_in_vnd;
      ALTER TABLE public.invoice DROP COLUMN IF EXISTS vat_value_in_vnd;
      ALTER TABLE public.invoice DROP COLUMN IF EXISTS total_value_in_vnd;
      ALTER TABLE public.invoice DROP COLUMN IF EXISTS value_before_vat_in_vnd;

      -- 7. Ensure mtr uses amount_in_base_currency instead of amount_in_vnd
      ALTER TABLE public.mtr ADD COLUMN IF NOT EXISTS amount_in_base_currency numeric(20,6);
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'mtr' AND column_name = 'amount_in_vnd') THEN
          EXECUTE 'UPDATE public.mtr SET amount_in_base_currency = amount_in_vnd WHERE amount_in_base_currency IS NULL';
          EXECUTE 'ALTER TABLE public.mtr DROP COLUMN IF EXISTS amount_in_vnd';
        END IF;
      END $$;

      -- 8. Ensure base_currency across my_company and cms_tenant_info defaults to VND
      UPDATE public.my_company SET base_currency = 'VND' WHERE base_currency IS NULL OR base_currency != 'VND';
      ALTER TABLE public.my_company ALTER COLUMN base_currency SET DEFAULT 'VND';
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'cms_tenant_info') THEN
          IF NOT EXISTS (SELECT 1 FROM public.cms_tenant_info LIMIT 1) THEN
            INSERT INTO public.cms_tenant_info (
              tenant_domain, tenant_api_key, plan_name, subscription_status, billing_status, base_currency, company_name, last_billing_amount
            ) VALUES (
              'localhost', 'dev_api_key', 'Enterprise Plan', 'Active', 'Tháng', 'VND', 'TERAX', 0
            );
          END IF;
          EXECUTE 'UPDATE public.cms_tenant_info SET base_currency = ''VND'' WHERE base_currency IS NULL OR base_currency != ''VND''';
          EXECUTE 'ALTER TABLE public.cms_tenant_info ALTER COLUMN base_currency SET DEFAULT ''VND''';
        END IF;
      END $$;
    `);

    console.log('[Migration] Base Currency columns and data verified successfully.');
  } catch (err) {
    console.error('[Migration] Failed to migrateBaseCurrencyColumns:', err.message);
  } finally {
    client.release();
  }
}

async function migrateStatusCatalogAndTypes() {
  const client = await pool.connect();
  try {
    // 1. Ensure table status_catalog and sequence exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.status_catalog (
        id integer PRIMARY KEY,
        table_name character varying(100) NOT NULL,
        column_name character varying(100) NOT NULL,
        status_key character varying(100) NOT NULL,
        display_name_vi character varying(100),
        display_name_en character varying(100),
        color_code character varying(50),
        log jsonb DEFAULT '[]'::jsonb,
        deleted_at timestamp without time zone,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE public.status_catalog ADD COLUMN IF NOT EXISTS display_name_vi character varying(100);
      ALTER TABLE public.status_catalog ADD COLUMN IF NOT EXISTS display_name_en character varying(100);
      ALTER TABLE public.status_catalog ADD COLUMN IF NOT EXISTS log jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE public.status_catalog ADD COLUMN IF NOT EXISTS deleted_at timestamp without time zone;

      CREATE SEQUENCE IF NOT EXISTS public.status_catalog_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

      ALTER SEQUENCE public.status_catalog_id_seq OWNED BY public.status_catalog.id;
      ALTER TABLE ONLY public.status_catalog ALTER COLUMN id SET DEFAULT nextval('public.status_catalog_id_seq'::regclass);
    `);

    // 2. Seed/update all status_catalog entries
    await client.query(`
      INSERT INTO public.status_catalog (id, table_name, column_name, status_key, display_name_vi, display_name_en, color_code) VALUES
        (1, 'request', 'sr_status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
        (2, 'request', 'sr_status', 'pending_approval', 'Chờ duyệt', 'Pending Approval', '#3b82f6'),
        (3, 'request', 'sr_status', 'approved', 'Đã duyệt', 'Approved', '#10b981'),
        (4, 'request', 'sr_status', 'rejected', 'Từ chối', 'Rejected', '#ef4444'),
        (5, 'request', 'sr_status', 'closed', 'Đã đóng', 'Closed', '#64748b'),
        (6, 'request', 'sr_status', 'cancelled', 'Đã hủy', 'Cancelled', '#ef4444'),
        (7, 'request', 'process_status', 'not_started', 'Chưa bắt đầu', 'Not started yet', '#64748b'),
        (8, 'request', 'process_status', 'processing', 'Đang xử lý', 'Processing', '#3b82f6'),
        (9, 'request', 'process_status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
        (10, 'ticket', 'sr_status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
        (11, 'ticket', 'sr_status', 'pending', 'Chờ xử lý', 'Pending', '#3b82f6'),
        (12, 'ticket', 'sr_status', 'in_progress', 'Đang xử lý', 'In Progress', '#3b82f6'),
        (13, 'ticket', 'sr_status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
        (14, 'ticket', 'process_status', 'not_started', 'Chưa bắt đầu', 'Not started yet', '#64748b'),
        (15, 'ticket', 'process_status', 'processing', 'Đang xử lý', 'Processing', '#3b82f6'),
        (16, 'ticket', 'process_status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
        (17, 'employee', 'status', 'active', 'Hoạt động', 'Active', '#10b981'),
        (18, 'employee', 'status', 'inactive', 'Không hoạt động', 'Inactive', '#ef4444'),
        (19, 'account', 'account_status', 'active', 'Hoạt động', 'Active', '#10b981'),
        (20, 'account', 'account_status', 'inactive', 'Không hoạt động', 'Inactive', '#ef4444'),
        (21, 'asset', 'status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
        (22, 'asset', 'status', 'pending', 'Chờ duyệt', 'Pending', '#3b82f6'),
        (23, 'asset', 'status', 'in_progress', 'Đang xử lý', 'In Progress', '#3b82f6'),
        (24, 'asset', 'status', 'approved', 'Đã duyệt', 'Approved', '#10b981'),
        (25, 'asset', 'status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
        (26, 'service', 'status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
        (27, 'service', 'status', 'pending', 'Chờ duyệt', 'Pending', '#3b82f6'),
        (28, 'service', 'status', 'in_progress', 'Đang xử lý', 'In Progress', '#3b82f6'),
        (29, 'service', 'status', 'completed', 'Đã hoàn thành', 'Completed', '#10b981'),
        (30, 'payment', 'payment_status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
        (31, 'payment', 'payment_status', 'ready_for_payment', 'Sẵn sàng thanh toán', 'Ready for payment', '#3b82f6'),
        (32, 'payment', 'payment_status', 'paid', 'Đã thanh toán', 'Paid', '#10b981'),
        (33, 'payment', 'payment_status', 'deleted', 'Đã xóa', 'Deleted', '#ef4444'),
        (121, 'payment', 'payment_status', 'submitted_for_payment', 'Chờ duyệt thanh toán', 'Submitted for payment', '#f59e0b'),
        (34, 'invoice', 'invoice_status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
        (35, 'invoice', 'invoice_status', 'ready_to_issue', 'Sẵn sàng xuất', 'Ready to issue', '#3b82f6'),
        (36, 'invoice', 'invoice_status', 'issued', 'Đã xuất', 'Issued', '#3b82f6'),
        (37, 'invoice', 'invoice_status', 'paid', 'Đã thanh toán', 'Paid', '#10b981'),
        (38, 'invoice', 'invoice_status', 'void', 'Bị hủy', 'Void', '#ef4444'),
        (39, 'invoice', 'invoice_status', 'deleted', 'Đã xóa', 'Deleted', '#ef4444'),
        (40, 'cms_tenant_info', 'billing_status', 'active', 'Hoạt động', 'Active', '#10b981'),
        (41, 'cms_tenant_info', 'billing_status', 'grace', 'Gia hạn thêm', 'Grace', '#ffa500'),
        (42, 'cms_tenant_info', 'billing_status', 'expired', 'Hết hạn', 'Expired', '#ef4444'),
        (43, 'cms_tenant_info', 'billing_status', 'canceled', 'Đã hủy', 'Canceled', '#ef4444'),
        (44, 'cms_tenant_info', 'billing_status', 'inactive', 'Ngừng hoạt động', 'Inactive', '#64748b'),
        (45, 'cms_tenant_info', 'subscription_status', 'active', 'Hoạt động', 'Active', '#10b981'),
        (46, 'cms_tenant_info', 'subscription_status', 'grace', 'Gia hạn thêm', 'Grace', '#ffa500'),
        (47, 'cms_tenant_info', 'subscription_status', 'expired', 'Hết hạn', 'Expired', '#ef4444'),
        (48, 'cms_tenant_info', 'subscription_status', 'canceled', 'Đã hủy', 'Canceled', '#ef4444'),
        (49, 'cms_tenant_info', 'subscription_status', 'inactive', 'Ngừng hoạt động', 'Inactive', '#64748b'),
        (50, 'my_location', 'status', 'active', 'Hoạt động', 'Active', '#10b981'),
        (51, 'my_location', 'status', 'inactive', 'Không hoạt động', 'Inactive', '#ef4444'),
        (52, 'oppotunity', 'status', 'open', 'Mở', 'Open', '#3b82f6'),
        (53, 'oppotunity', 'status', 'closed_won', 'Thành công', 'Closed Won', '#10b981'),
        (54, 'oppotunity', 'status', 'closed_lost', 'Thất bại', 'Closed Lost', '#ef4444'),
        (55, 'mtr', 'status', 'draft', 'Bản nháp', 'Draft', '#64748b'),
        (56, 'mtr', 'status', 'approved', 'Đã duyệt', 'Approved', '#10b981'),
        (57, 'finance', 'status', 'active', 'Hoạt động', 'Active', '#10b981'),
        (58, 'finance', 'status', 'inactive', 'Không hoạt động', 'Inactive', '#ef4444'),
        (60, 'payment', 'payment_type', 'incoming', 'Khoản thu', 'Incoming', '#10b981'),
        (61, 'payment', 'payment_type', 'outgoing', 'Khoản chi', 'Outgoing', '#f59e0b'),
        (62, 'assigned_task', 'status', 'not_started', 'Chưa bắt đầu', 'Not started yet', '#64748b'),
        (63, 'assigned_task', 'status', 'processing', 'Đang xử lý', 'Processing', '#3b82f6'),
        (64, 'assigned_task', 'status', 'completed', 'Hoàn thành', 'Completed', '#10b981'),
        (65, 'task_subtask', 'status', 'pending', 'Chờ xử lý', 'Pending', '#f59e0b'),
        (66, 'task_subtask', 'status', 'completed', 'Hoàn thành', 'Completed', '#10b981'),
        (67, 'my_company', 'status', 'active', 'Hoạt động', 'Active', '#10b981'),
        (68, 'my_company', 'status', 'inactive', 'Ngưng hoạt động', 'Inactive', '#ef4444'),
        (69, 'contract', 'type', 'selling', 'Bán ra', 'Selling', '#10B981'),
        (70, 'contract', 'type', 'buying', 'Mua vào', 'Buying', '#EF4444'),
        (71, 'contract', 'type', 'internal', 'Nội bộ', 'Internal', '#6366F1'),
        (72, 'expense', 'id__expense_type', 'expense', 'Chi phí', 'Expense', '#3b82f6'),
        (73, 'expense', 'id__expense_type', 'non_expense', 'Không phải chi phí', 'Non-Expense', '#64748b'),
        (74, 'expense', 'id__expense_cost', 'operation_cost', 'Chi phí vận hành', 'Operation Cost', '#10b981'),
        (75, 'expense', 'id__expense_cost', 'sales_cost', 'Chi phí bán hàng', 'Sales Cost', '#f59e0b'),
        (76, 'expense', 'id__expense_cost', 'fixed_cost', 'Chi phí cố định', 'Fixed cost', '#6366f1'),
        (77, 'expense', 'id__expense_cost', 'variable_cost', 'Chi phí biến đổi', 'Variable cost', '#ec4899'),
        (78, 'expense', 'id__expense_cost', 'operation_expense', 'Chi phí vận hành', 'Operation expense', '#06b6d4'),
        (79, 'expense', 'id__expense_cost', 'sale_expense', 'Chi phí bán hàng', 'Sale expense', '#8b5cf6'),
        (80, 'expense', 'id__expense_cost', 'others', 'Khác', 'Others', '#94a3b8'),
        (81, 'service', 'service_type', 'subcription', 'Thuê bao', 'Subcription', '#3b82f6'),
        (82, 'service', 'service_type', '1_time_service', 'Dịch vụ 1 lần', '1 Time service', '#10b981'),
        (83, 'service', 'service_type', 'rental_loan', 'Thuê | Mượn', 'Rental | Loan', '#f59e0b'),
        (84, 'service', 'service_type', 'borrow', 'Mượn', 'Borrow', '#8b5cf6'),
        (85, 'service', 'service_type', 'annual_renew', 'Gia hạn hàng năm', 'Annual Renew', '#06b6d4'),
        (117, 'request', 'process_status', 'canceled', 'Đã hủy', 'Canceled', '#ef4444'),
        (118, 'ticket', 'sr_status', 'cancelled', 'Đã hủy', 'Cancelled', '#ef4444'),
        (119, 'ticket', 'process_status', 'cancelled', 'Đã hủy', 'Cancelled', '#ef4444'),
        (120, 'ticket', 'process_status', 'draft', 'Bản nháp', 'Draft', '#64748b')
      ON CONFLICT (id) DO UPDATE SET
        table_name = EXCLUDED.table_name,
        column_name = EXCLUDED.column_name,
        status_key = EXCLUDED.status_key,
        display_name_vi = EXCLUDED.display_name_vi,
        display_name_en = EXCLUDED.display_name_en,
        color_code = EXCLUDED.color_code;

      SELECT setval('public.status_catalog_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.status_catalog));
    `);

    // 3. Ensure columns in expense and service are integer (handling migration if text)
    await client.query(`
      DO $$
      BEGIN
        -- Migrate expense.id__expense_type if it is character varying
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'expense' AND column_name = 'id__expense_type' AND data_type = 'character varying'
        ) THEN
          UPDATE expense SET id__expense_type = '72' WHERE LOWER(TRIM(id__expense_type)) = 'expense';
          UPDATE expense SET id__expense_type = '73' WHERE LOWER(TRIM(id__expense_type)) IN ('non-expense', 'non expense', 'non_expense');
          UPDATE expense SET id__expense_type = NULL WHERE id__expense_type IS NOT NULL AND id__expense_type !~ '^[0-9]+$';
          ALTER TABLE expense ALTER COLUMN id__expense_type TYPE integer USING id__expense_type::integer;
        END IF;

        -- Migrate expense.id__expense_cost if it is character varying
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'expense' AND column_name = 'id__expense_cost' AND data_type = 'character varying'
        ) THEN
          UPDATE expense SET id__expense_cost = '74' WHERE LOWER(REPLACE(id__expense_cost, CHR(160), ' ')) = 'operation cost';
          UPDATE expense SET id__expense_cost = '75' WHERE LOWER(REPLACE(id__expense_cost, CHR(160), ' ')) = 'sales cost';
          UPDATE expense SET id__expense_cost = '76' WHERE LOWER(REPLACE(id__expense_cost, CHR(160), ' ')) = 'fixed cost';
          UPDATE expense SET id__expense_cost = '77' WHERE LOWER(REPLACE(id__expense_cost, CHR(160), ' ')) = 'variable cost';
          UPDATE expense SET id__expense_cost = '78' WHERE LOWER(REPLACE(id__expense_cost, CHR(160), ' ')) = 'operation expense';
          UPDATE expense SET id__expense_cost = '79' WHERE LOWER(REPLACE(id__expense_cost, CHR(160), ' ')) = 'sale expense';
          UPDATE expense SET id__expense_cost = '80' WHERE LOWER(REPLACE(id__expense_cost, CHR(160), ' ')) = 'others';
          UPDATE expense SET id__expense_cost = NULL WHERE id__expense_cost IS NOT NULL AND id__expense_cost !~ '^[0-9]+$';
          ALTER TABLE expense ALTER COLUMN id__expense_cost TYPE integer USING id__expense_cost::integer;
        END IF;

        -- Migrate service.service_type if it is character varying
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'service' AND column_name = 'service_type' AND data_type = 'character varying'
        ) THEN
          UPDATE service SET service_type = '81' WHERE LOWER(TRIM(service_type)) = 'subcription' OR LOWER(TRIM(service_type)) = 'subscription';
          UPDATE service SET service_type = '82' WHERE LOWER(TRIM(service_type)) = '1 time service';
          UPDATE service SET service_type = '83' WHERE LOWER(TRIM(service_type)) = 'rental | loan';
          UPDATE service SET service_type = '84' WHERE LOWER(TRIM(service_type)) = 'borrow';
          UPDATE service SET service_type = '85' WHERE LOWER(TRIM(service_type)) = 'annual renew';
          UPDATE service SET service_type = NULL WHERE service_type IS NOT NULL AND service_type !~ '^[0-9]+$';
          ALTER TABLE service ALTER COLUMN service_type TYPE integer USING service_type::integer;
        END IF;
      END $$;
    `);

    console.log('[Migration] status_catalog and column types verified successfully.');
  } catch (err) {
    console.error('[Migration] Failed to migrateStatusCatalogAndTypes:', err.message);
  } finally {
    client.release();
  }
}


