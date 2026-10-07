const DEBUG_SQL = process.env.DEBUG_SQL === 'true';

async function runSchemaV1(pool, seeds) {
  const {
    ensureSystemPoliciesSeed,
    migrateCompanyData,
    seedDefaultPermissions,
    cleanLegacyEmails,
    migrateEmptyEmployeeRoles,
    migrateLegacyTaskPolicyElements,
    migrateTaskInfoComment,
    migrateHeadManagerColumn
  } = seeds;

  return pool.query(`
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

    -- Create request_rating table (strictly anonymous, no created_by/updated_by)
    EXECUTE 'CREATE TABLE IF NOT EXISTS public.request_rating (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      request_id character varying(255) NOT NULL,
      from_user character varying(255) NOT NULL,
      to_user character varying(255) NOT NULL,
      point integer NOT NULL,
      comment text,
      created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
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
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'my_company' AND column_name = 'timezone') THEN
      EXECUTE 'ALTER TABLE "my_company" ADD COLUMN timezone VARCHAR(100) DEFAULT ''Asia/Ho_Chi_Minh''';
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

          -- Remove redundant RPM policy if exists
          DELETE FROM policy_and_program WHERE policy_id = ''RPM'';

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
    EXCEPTION WHEN OTHERS THEN
      -- If function cannot be replaced due to permissions (e.g. non-owner tenant user), keep existing function
      NULL;
    END;
  END $dyn_trg$;

  DO $$
  BEGIN
    DROP TRIGGER IF EXISTS trg_request_submit_status ON public.request;

    CREATE TRIGGER trg_request_submit_status
    BEFORE INSERT OR UPDATE OF sr_status
    ON public.request
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_request_submit_status();
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END $$;

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
  DO $$
  BEGIN
    CREATE OR REPLACE FUNCTION safe_parse_jsonb(val text)
    RETURNS jsonb AS $f$
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
    $f$ LANGUAGE plpgsql;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping safe_parse_jsonb recreation: %', SQLERRM;
  END $$;

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
  DO $outer$
  BEGIN
    CREATE OR REPLACE FUNCTION audit_log_trigger()
    RETURNS TRIGGER AS $func$
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
    $func$ LANGUAGE plpgsql;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping audit_log_trigger creation: %', SQLERRM;
  END $outer$;

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
            AND table_name NOT IN ('pg_stat_statements', 'push_subscriptions', 'audit_logs', 'request_rating')
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
  DO $outer$
  BEGIN
    CREATE OR REPLACE FUNCTION cascade_soft_delete_trigger()
    RETURNS TRIGGER AS $func$
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
    $func$ LANGUAGE plpgsql;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping cascade_soft_delete_trigger creation: %', SQLERRM;
  END $outer$;

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
  DO $outer$
  BEGIN
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

    DROP TRIGGER IF EXISTS trg_sync_payment_request ON public.payment;
    CREATE TRIGGER trg_sync_payment_request
    BEFORE INSERT OR UPDATE ON public.payment
    FOR EACH ROW EXECUTE FUNCTION public.sync_request_and_source_from_contract();

    DROP TRIGGER IF EXISTS trg_sync_invoice_request ON public.invoice;
    CREATE TRIGGER trg_sync_invoice_request
    BEFORE INSERT OR UPDATE ON public.invoice
    FOR EACH ROW EXECUTE FUNCTION public.sync_request_and_source_from_contract();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping sync_request_and_source_from_contract: %', SQLERRM;
  END $outer$;

  -- Create or replace function to propagate request changes from contract
  DO $outer$
  BEGIN
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

    DROP TRIGGER IF EXISTS trg_propagate_contract_request ON public.contract;
    CREATE TRIGGER trg_propagate_contract_request
    AFTER UPDATE OF request ON public.contract
    FOR EACH ROW EXECUTE FUNCTION public.propagate_contract_request_change();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping propagate_contract_request_change: %', SQLERRM;
  END $outer$;

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
      await ensureSystemPoliciesSeed();
    } catch (e) {
      console.error('Failed to run ensureSystemPoliciesSeed:', e);
    }
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

module.exports = { runSchemaV1 };
