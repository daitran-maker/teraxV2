const fs = require('fs');
const path = require('path');
const pool = require('../core/db');
const seeds = require('./seeds');
const DEBUG_SQL = process.env.DEBUG_SQL === 'true';

const {
  dropDeprecatedFinanceColumns,
  migrateFinanceView,
  migrateTaskInfoComment,
  migrateHeadManagerColumn,
  migrateLegacyTaskPolicyElements
} = seeds;

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
  try {
    await migrateByteaImageColumns();
  } catch (e) {
    console.error('Failed to run migrateByteaImageColumns migration:', e);
  }
  try {
    await migrateAutoCompleteApprovedPaymentRequests();
  } catch (e) {
    console.error('Failed to run migrateAutoCompleteApprovedPaymentRequests migration:', e);
  }
}

async function migrateAutoCompleteApprovedPaymentRequests() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      UPDATE request 
      SET process_status = 9, 
          process_start_date = COALESCE(process_start_date, sr_submitted_date, sr_created_date, CURRENT_TIMESTAMP), 
          process_end_date = COALESCE(process_end_date, CURRENT_TIMESTAMP)
      WHERE (request_type IN ('5', 'RPM') OR UPPER(request_type) = 'PAYMENT') 
        AND sr_status = 3 
        AND process_status != 9;
    `);
    if (res.rowCount > 0) {
      console.log(`[Migration] Auto-completed ${res.rowCount} approved payment requests.`);
    }

    const payRes = await client.query(`
      UPDATE "payment"
      SET payment_status = 31
      WHERE payment_status IN (30, 121)
        AND (
          payment_request IN (
            SELECT request_id FROM request 
            WHERE (request_type IN ('5', 'RPM') OR UPPER(request_type) = 'PAYMENT') AND sr_status = 3
          )
          OR request IN (
            SELECT request_id FROM request 
            WHERE (request_type IN ('5', 'RPM') OR UPPER(request_type) = 'PAYMENT') AND sr_status = 3
          )
        );
    `);
    if (payRes.rowCount > 0) {
      console.log(`[Migration] Synced ${payRes.rowCount} linked payments to Ready for payment (31).`);
    }
  } catch (err) {
    console.error('Error running migrateAutoCompleteApprovedPaymentRequests:', err);
  } finally {
    client.release();
  }
}

async function migrateByteaImageColumns() {
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'my_company' AND column_name = 'logo' AND data_type = 'bytea'
        ) THEN
          ALTER TABLE public.my_company ALTER COLUMN logo TYPE text USING (CASE WHEN logo IS NOT NULL THEN convert_from(logo, 'UTF8') ELSE NULL END);
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'employee' AND column_name = 'avatar' AND data_type = 'bytea'
        ) THEN
          ALTER TABLE public.employee ALTER COLUMN avatar TYPE text USING (CASE WHEN avatar IS NOT NULL THEN convert_from(avatar, 'UTF8') ELSE NULL END);
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'employee' AND column_name = 'picture' AND data_type = 'bytea'
        ) THEN
          ALTER TABLE public.employee ALTER COLUMN picture TYPE text USING (CASE WHEN picture IS NOT NULL THEN convert_from(picture, 'UTF8') ELSE NULL END);
        END IF;
      END $$;
    `);
  } catch (err) {
    console.error('migrateByteaImageColumns error:', err.message);
  } finally {
    client.release();
  }
}

async function migrateUtc0Standardization() {
  const fs = require('fs');
  const path = require('path');
  const migrationFile = path.join(__dirname, '..', '..', 'migrations', '2026-09-18_utc0_standardization.sql');
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
          -- Never audit log anonymous tables (e.g., request_rating feedback)
          IF TG_TABLE_NAME = 'request_rating' THEN
              IF (TG_OP = 'DELETE') THEN
                  RETURN OLD;
              ELSE
                  RETURN NEW;
              END IF;
          END IF;

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
    try {
      await client.query(triggerSQL);
    } catch (tErr) {
      console.warn('[Migration] Skipping audit_log_trigger recreation (function owner permission):', tErr.message);
    }

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

      -- Ensure request_rating is strictly anonymous: drop trigger, clean audit logs, nullify created_by/updated_by
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'request_rating') THEN
          DROP TRIGGER IF EXISTS trg_audit_log ON public.request_rating;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request_rating' AND column_name = 'created_by') THEN
            EXECUTE 'UPDATE request_rating SET created_by = NULL WHERE created_by IS NOT NULL';
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'request_rating' AND column_name = 'updated_by') THEN
            EXECUTE 'UPDATE request_rating SET updated_by = NULL WHERE updated_by IS NOT NULL';
          END IF;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'audit_logs') THEN
          DELETE FROM audit_logs WHERE table_name = 'request_rating';
        END IF;
      END $$;
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




module.exports = { runIncrementalMigrations };
