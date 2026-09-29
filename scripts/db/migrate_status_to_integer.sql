-- ============================================================================
-- MIGRATION SCRIPT: UNIFY ALL STATUS AND TYPE COLUMNS TO INTEGER STATUS IDs
-- References: status_catalog (server/helpers/statuses.js)
-- ============================================================================

BEGIN;

-- Drop trigger depending on sr_status if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_trigger WHERE tgname = 'trg_request_submit_status') THEN
    DROP TRIGGER trg_request_submit_status ON public.request;
  END IF;
END $$;

-- 1. REQUEST TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'request') THEN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'request' AND column_name = 'sr_status') THEN
      UPDATE "request" SET sr_status = '1' WHERE LOWER(TRIM(COALESCE(sr_status::text, ''))) IN ('draft', '1');
      UPDATE "request" SET sr_status = '2' WHERE LOWER(TRIM(COALESCE(sr_status::text, ''))) IN ('pending approval', 'pending_approval', 'submit', 'submitted', 'pending', '2');
      UPDATE "request" SET sr_status = '3' WHERE LOWER(TRIM(COALESCE(sr_status::text, ''))) IN ('approved', '3');
      UPDATE "request" SET sr_status = '4' WHERE LOWER(TRIM(COALESCE(sr_status::text, ''))) IN ('rejected', '4');
      UPDATE "request" SET sr_status = '5' WHERE LOWER(TRIM(COALESCE(sr_status::text, ''))) IN ('closed', '5');
      UPDATE "request" SET sr_status = '6' WHERE LOWER(TRIM(COALESCE(sr_status::text, ''))) IN ('cancelled', 'canceled', '6');
      UPDATE "request" SET sr_status = '1' WHERE sr_status IS NOT NULL AND sr_status::text !~ '^[0-9]+$';

      ALTER TABLE "request" ALTER COLUMN sr_status DROP DEFAULT;
      ALTER TABLE "request" ALTER COLUMN sr_status TYPE INTEGER USING COALESCE(NULLIF(TRIM(sr_status::text), ''), '1')::integer;
      ALTER TABLE "request" ALTER COLUMN sr_status SET DEFAULT 1;
    END IF;

    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'request' AND column_name = 'process_status') THEN
      UPDATE "request" SET process_status = '7' WHERE LOWER(TRIM(COALESCE(process_status::text, ''))) IN ('not started yet', 'not started', 'not_started', '7');
      UPDATE "request" SET process_status = '8' WHERE LOWER(TRIM(COALESCE(process_status::text, ''))) IN ('processing', 'in progress', 'in_progress', '8');
      UPDATE "request" SET process_status = '9' WHERE LOWER(TRIM(COALESCE(process_status::text, ''))) IN ('completed', 'done', '9');
      UPDATE "request" SET process_status = '117' WHERE LOWER(TRIM(COALESCE(process_status::text, ''))) IN ('canceled', 'cancelled', '117');
      UPDATE "request" SET process_status = '7' WHERE process_status IS NOT NULL AND process_status::text !~ '^[0-9]+$';

      ALTER TABLE "request" ALTER COLUMN process_status DROP DEFAULT;
      ALTER TABLE "request" ALTER COLUMN process_status TYPE INTEGER USING COALESCE(NULLIF(TRIM(process_status::text), ''), '7')::integer;
      ALTER TABLE "request" ALTER COLUMN process_status SET DEFAULT 7;
    END IF;
  END IF;
END $$;

-- 2. TICKET TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ticket') THEN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ticket' AND column_name = 'sr_status') THEN
      UPDATE "ticket" SET sr_status = '10' WHERE LOWER(TRIM(COALESCE(sr_status::text, ''))) IN ('draft', '10');
      UPDATE "ticket" SET sr_status = '11' WHERE LOWER(TRIM(COALESCE(sr_status::text, ''))) IN ('pending', 'pending_approval', '11');
      UPDATE "ticket" SET sr_status = '12' WHERE LOWER(TRIM(COALESCE(sr_status::text, ''))) IN ('in progress', 'in_progress', 'in-progress', '12');
      UPDATE "ticket" SET sr_status = '13' WHERE LOWER(TRIM(COALESCE(sr_status::text, ''))) IN ('completed', 'done', '13');
      UPDATE "ticket" SET sr_status = '118' WHERE LOWER(TRIM(COALESCE(sr_status::text, ''))) IN ('cancelled', 'canceled', '118');
      UPDATE "ticket" SET sr_status = '10' WHERE sr_status IS NOT NULL AND sr_status::text !~ '^[0-9]+$';

      ALTER TABLE "ticket" ALTER COLUMN sr_status DROP DEFAULT;
      ALTER TABLE "ticket" ALTER COLUMN sr_status TYPE INTEGER USING COALESCE(NULLIF(TRIM(sr_status::text), ''), '10')::integer;
      ALTER TABLE "ticket" ALTER COLUMN sr_status SET DEFAULT 10;
    END IF;

    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ticket' AND column_name = 'process_status') THEN
      UPDATE "ticket" SET process_status = '14' WHERE LOWER(TRIM(COALESCE(process_status::text, ''))) IN ('not started yet', 'not started', 'not_started', '14');
      UPDATE "ticket" SET process_status = '15' WHERE LOWER(TRIM(COALESCE(process_status::text, ''))) IN ('processing', '15');
      UPDATE "ticket" SET process_status = '16' WHERE LOWER(TRIM(COALESCE(process_status::text, ''))) IN ('completed', 'done', '16');
      UPDATE "ticket" SET process_status = '119' WHERE LOWER(TRIM(COALESCE(process_status::text, ''))) IN ('cancelled', 'canceled', '119');
      UPDATE "ticket" SET process_status = '120' WHERE LOWER(TRIM(COALESCE(process_status::text, ''))) IN ('draft', '120');
      UPDATE "ticket" SET process_status = '14' WHERE process_status IS NOT NULL AND process_status::text !~ '^[0-9]+$';

      ALTER TABLE "ticket" ALTER COLUMN process_status DROP DEFAULT;
      ALTER TABLE "ticket" ALTER COLUMN process_status TYPE INTEGER USING COALESCE(NULLIF(TRIM(process_status::text), ''), '14')::integer;
      ALTER TABLE "ticket" ALTER COLUMN process_status SET DEFAULT 14;
    END IF;
  END IF;
END $$;

-- 3. EMPLOYEE TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee') THEN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employee' AND column_name = 'status') THEN
      UPDATE "employee" SET status = '17' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('active', '17');
      UPDATE "employee" SET status = '18' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('inactive', '18');
      UPDATE "employee" SET status = '17' WHERE status IS NULL OR status::text !~ '^[0-9]+$';
      ALTER TABLE "employee" ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE "employee" ALTER COLUMN status TYPE INTEGER USING status::integer;
      ALTER TABLE "employee" ALTER COLUMN status SET DEFAULT 17;
    END IF;
  END IF;
END $$;

-- 4. ACCOUNT TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'account') THEN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'account_status') THEN
      UPDATE "account" SET account_status = '19' WHERE LOWER(TRIM(COALESCE(account_status::text, ''))) IN ('active', 'open', '19');
      UPDATE "account" SET account_status = '20' WHERE LOWER(TRIM(COALESCE(account_status::text, ''))) IN ('inactive', 'closed', '20');
      UPDATE "account" SET account_status = '19' WHERE account_status IS NULL OR account_status::text !~ '^[0-9]+$';
      ALTER TABLE "account" ALTER COLUMN account_status DROP DEFAULT;
      ALTER TABLE "account" ALTER COLUMN account_status TYPE INTEGER USING account_status::integer;
      ALTER TABLE "account" ALTER COLUMN account_status SET DEFAULT 19;
    END IF;
  END IF;
END $$;

-- 5. ASSET TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'asset') THEN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'asset' AND column_name = 'status') THEN
      UPDATE "asset" SET status = '21' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('draft', '21');
      UPDATE "asset" SET status = '22' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('pending', 'active', '22');
      UPDATE "asset" SET status = '23' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('in-used', 'in_progress', 'in progress', '23');
      UPDATE "asset" SET status = '24' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('approved', '24');
      UPDATE "asset" SET status = '25' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('completed', 'no-used', 'failured', '25');
      UPDATE "asset" SET status = '21' WHERE status IS NULL OR status::text !~ '^[0-9]+$';
      ALTER TABLE "asset" ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE "asset" ALTER COLUMN status TYPE INTEGER USING status::integer;
      ALTER TABLE "asset" ALTER COLUMN status SET DEFAULT 21;
    END IF;
  END IF;
END $$;

-- 6. SERVICE TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service') THEN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'service' AND column_name = 'status') THEN
      UPDATE "service" SET status = '26' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('draft', '26');
      UPDATE "service" SET status = '27' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('pending', 'active', '27');
      UPDATE "service" SET status = '28' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('on-going', 'in_progress', 'in progress', '28');
      UPDATE "service" SET status = '29' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('completed', 'expired', 'going to expired', '29');
      UPDATE "service" SET status = '26' WHERE status IS NULL OR status::text !~ '^[0-9]+$';
      ALTER TABLE "service" ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE "service" ALTER COLUMN status TYPE INTEGER USING status::integer;
      ALTER TABLE "service" ALTER COLUMN status SET DEFAULT 26;
    END IF;
  END IF;
END $$;

-- 7. PAYMENT TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment') THEN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment' AND column_name = 'payment_status') THEN
      UPDATE "payment" SET payment_status = '30' WHERE LOWER(TRIM(COALESCE(payment_status::text, ''))) IN ('draft', 'expired draft', '30');
      UPDATE "payment" SET payment_status = '31' WHERE LOWER(TRIM(COALESCE(payment_status::text, ''))) IN ('ready_for_payment', 'ready for payment', 'submitted for payment', 'pending payment', 'not due yet', 'overdue', '31');
      UPDATE "payment" SET payment_status = '32' WHERE LOWER(TRIM(COALESCE(payment_status::text, ''))) IN ('paid', '32');
      UPDATE "payment" SET payment_status = '33' WHERE LOWER(TRIM(COALESCE(payment_status::text, ''))) IN ('deleted', 'void', '33');
      UPDATE "payment" SET payment_status = '30' WHERE payment_status IS NULL OR payment_status::text !~ '^[0-9]+$';
      ALTER TABLE "payment" ALTER COLUMN payment_status DROP DEFAULT;
      ALTER TABLE "payment" ALTER COLUMN payment_status TYPE INTEGER USING payment_status::integer;
      ALTER TABLE "payment" ALTER COLUMN payment_status SET DEFAULT 30;
    END IF;

    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment' AND column_name = 'payment_type') THEN
      UPDATE "payment" SET payment_type = '60' WHERE LOWER(TRIM(COALESCE(payment_type::text, ''))) IN ('incoming', 'incoming payment', '60');
      UPDATE "payment" SET payment_type = '61' WHERE LOWER(TRIM(COALESCE(payment_type::text, ''))) IN ('outgoing', 'outgoing payment', '61');
      UPDATE "payment" SET payment_type = '61' WHERE payment_type IS NULL OR payment_type::text !~ '^[0-9]+$';
      ALTER TABLE "payment" ALTER COLUMN payment_type DROP DEFAULT;
      ALTER TABLE "payment" ALTER COLUMN payment_type TYPE INTEGER USING payment_type::integer;
      ALTER TABLE "payment" ALTER COLUMN payment_type SET DEFAULT 61;
    END IF;
  END IF;
END $$;

-- 8. INVOICE TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invoice') THEN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoice' AND column_name = 'invoice_status') THEN
      UPDATE "invoice" SET invoice_status = '34' WHERE LOWER(TRIM(COALESCE(invoice_status::text, ''))) IN ('draft', '34');
      UPDATE "invoice" SET invoice_status = '35' WHERE LOWER(TRIM(COALESCE(invoice_status::text, ''))) IN ('ready_to_issue', 'ready to issue', 'submitted', 'received', '35');
      UPDATE "invoice" SET invoice_status = '36' WHERE LOWER(TRIM(COALESCE(invoice_status::text, ''))) IN ('issued', '36');
      UPDATE "invoice" SET invoice_status = '37' WHERE LOWER(TRIM(COALESCE(invoice_status::text, ''))) IN ('paid', '37');
      UPDATE "invoice" SET invoice_status = '38' WHERE LOWER(TRIM(COALESCE(invoice_status::text, ''))) IN ('void', 'rejected', '38');
      UPDATE "invoice" SET invoice_status = '39' WHERE LOWER(TRIM(COALESCE(invoice_status::text, ''))) IN ('deleted', '39');
      UPDATE "invoice" SET invoice_status = '34' WHERE invoice_status IS NULL OR invoice_status::text !~ '^[0-9]+$';
      ALTER TABLE "invoice" ALTER COLUMN invoice_status DROP DEFAULT;
      ALTER TABLE "invoice" ALTER COLUMN invoice_status TYPE INTEGER USING invoice_status::integer;
      ALTER TABLE "invoice" ALTER COLUMN invoice_status SET DEFAULT 34;
    END IF;
  END IF;
END $$;

-- 9. CONTRACT TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contract') THEN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contract' AND column_name = 'type') THEN
      UPDATE "contract" SET type = '69' WHERE LOWER(TRIM(COALESCE(type::text, ''))) IN ('selling', '69');
      UPDATE "contract" SET type = '70' WHERE LOWER(TRIM(COALESCE(type::text, ''))) IN ('buying', '70');
      UPDATE "contract" SET type = '71' WHERE LOWER(TRIM(COALESCE(type::text, ''))) IN ('internal', '71');
      UPDATE "contract" SET type = '69' WHERE type IS NULL OR type::text !~ '^[0-9]+$';
      ALTER TABLE "contract" ALTER COLUMN type DROP DEFAULT;
      ALTER TABLE "contract" ALTER COLUMN type TYPE INTEGER USING type::integer;
      ALTER TABLE "contract" ALTER COLUMN type SET DEFAULT 69;
    END IF;
  END IF;
END $$;

-- 10. MY_COMPANY TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'my_company') THEN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'my_company' AND column_name = 'status') THEN
      ALTER TABLE "my_company" ADD COLUMN status INTEGER DEFAULT 67;
    ELSE
      UPDATE "my_company" SET status = '67' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('active', '67');
      UPDATE "my_company" SET status = '68' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('inactive', '68');
      UPDATE "my_company" SET status = '67' WHERE status IS NULL OR status::text !~ '^[0-9]+$';
      ALTER TABLE "my_company" ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE "my_company" ALTER COLUMN status TYPE INTEGER USING status::integer;
      ALTER TABLE "my_company" ALTER COLUMN status SET DEFAULT 67;
    END IF;
  END IF;
END $$;

-- 11. MY_LOCATION TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'my_location') THEN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'my_location' AND column_name = 'status') THEN
      ALTER TABLE "my_location" ADD COLUMN status INTEGER DEFAULT 50;
    ELSE
      UPDATE "my_location" SET status = '50' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('active', '50');
      UPDATE "my_location" SET status = '51' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('inactive', '51');
      UPDATE "my_location" SET status = '50' WHERE status IS NULL OR status::text !~ '^[0-9]+$';
      ALTER TABLE "my_location" ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE "my_location" ALTER COLUMN status TYPE INTEGER USING status::integer;
      ALTER TABLE "my_location" ALTER COLUMN status SET DEFAULT 50;
    END IF;
  END IF;
END $$;

-- 12. OPPOTUNITY TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'oppotunity') THEN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'oppotunity' AND column_name = 'status') THEN
      ALTER TABLE "oppotunity" ADD COLUMN status INTEGER DEFAULT 52;
    ELSE
      UPDATE "oppotunity" SET status = '52' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('open', '52');
      UPDATE "oppotunity" SET status = '53' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('closed won', 'closed_won', '53');
      UPDATE "oppotunity" SET status = '54' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('closed lost', 'closed_lost', '54');
      UPDATE "oppotunity" SET status = '52' WHERE status IS NULL OR status::text !~ '^[0-9]+$';
      ALTER TABLE "oppotunity" ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE "oppotunity" ALTER COLUMN status TYPE INTEGER USING status::integer;
      ALTER TABLE "oppotunity" ALTER COLUMN status SET DEFAULT 52;
    END IF;
  END IF;
END $$;

-- 13. MTR TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mtr') THEN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mtr' AND column_name = 'status') THEN
      ALTER TABLE "mtr" ADD COLUMN status INTEGER DEFAULT 55;
    ELSE
      UPDATE "mtr" SET status = '55' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('draft', '55');
      UPDATE "mtr" SET status = '56' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('approved', '56');
      UPDATE "mtr" SET status = '55' WHERE status IS NULL OR status::text !~ '^[0-9]+$';
      ALTER TABLE "mtr" ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE "mtr" ALTER COLUMN status TYPE INTEGER USING status::integer;
      ALTER TABLE "mtr" ALTER COLUMN status SET DEFAULT 55;
    END IF;
  END IF;
END $$;

-- 14. ASSIGNED_TASK TABLE
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'assigned_task') THEN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'assigned_task' AND column_name = 'status') THEN
      ALTER TABLE "assigned_task" ADD COLUMN status INTEGER DEFAULT 62;
    ELSE
      UPDATE "assigned_task" SET status = '62' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('not started', 'not started yet', 'not_started', '62');
      UPDATE "assigned_task" SET status = '63' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('processing', '63');
      UPDATE "assigned_task" SET status = '64' WHERE LOWER(TRIM(COALESCE(status::text, ''))) IN ('completed', 'done', '64');
      UPDATE "assigned_task" SET status = '62' WHERE status IS NULL OR status::text !~ '^[0-9]+$';
      ALTER TABLE "assigned_task" ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE "assigned_task" ALTER COLUMN status TYPE INTEGER USING status::integer;
      ALTER TABLE "assigned_task" ALTER COLUMN status SET DEFAULT 62;
    END IF;
  END IF;
END $$;

-- Recreate trigger for request submit status with integer comparisons
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'request') THEN
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

      CREATE TRIGGER trg_request_submit_status
      BEFORE INSERT OR UPDATE OF sr_status
      ON public.request
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_request_submit_status();
    ';
  END IF;
END $$;

COMMIT;
