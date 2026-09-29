-- ==============================================================================
-- DATABASE MIGRATION: MIGRATE USER IDENTITY FROM EMAIL TO EMPLOYEE ID
-- ==============================================================================

BEGIN;

-- Helper Function to resolve comma-separated or bracketed email lists to employee IDs
CREATE OR REPLACE FUNCTION public.resolve_emails_to_employee_ids(email_str text)
RETURNS text AS $$
DECLARE
    clean_email text;
    emp_id text;
    result_str text := '';
    r record;
BEGIN
    IF email_str IS NULL OR email_str = '' THEN
        RETURN email_str;
    END IF;

    FOR r IN 
        SELECT DISTINCT TRIM(REPLACE(REPLACE(val, '[', ''), ']', '')) as email
        FROM regexp_split_to_table(email_str, '\s*,\s*') as val
    LOOP
        IF r.email != '' THEN
            SELECT employee_id INTO emp_id 
            FROM employee 
            WHERE LOWER(email) = LOWER(r.email) LIMIT 1;
            
            IF emp_id IS NOT NULL THEN
                IF result_str != '' THEN
                    result_str := result_str || ',' || emp_id;
                ELSE
                    result_str := emp_id;
                END IF;
            ELSE
                -- Fallback to original if no employee found
                IF result_str != '' THEN
                    result_str := result_str || ',' || r.email;
                ELSE
                    result_str := r.email;
                END IF;
            END IF;
        END IF;
    END LOOP;
    
    RETURN result_str;
END;
$$ LANGUAGE plpgsql;

-- Helper to safely update columns if they exist
CREATE OR REPLACE FUNCTION public.safe_update_column_email_to_emp_id(tbl_name text, col_name text)
RETURNS void AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = col_name
    ) THEN
        EXECUTE format(
            'UPDATE %I SET %I = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(%I) LIMIT 1), %I)',
            tbl_name, col_name, col_name, col_name
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Helper to safely resolve email lists in columns if they exist
CREATE OR REPLACE FUNCTION public.safe_resolve_column_email_list(tbl_name text, col_name text)
RETURNS void AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = col_name
    ) THEN
        EXECUTE format(
            'UPDATE %I SET %I = public.resolve_emails_to_employee_ids(%I)',
            tbl_name, col_name, col_name
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 1. MIGRATE "notification" TABLE
-- Add temporary column user_employee_id
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS user_employee_id VARCHAR(100);

-- Migrate values
UPDATE "notification" n
SET user_employee_id = COALESCE(
    (SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(n.user_email) LIMIT 1),
    n.user_email
);

-- Drop old column constraint if exists, and replace
ALTER TABLE "notification" DROP COLUMN IF EXISTS user_email;
ALTER TABLE "notification" RENAME COLUMN user_employee_id TO user_email;

-- 2. MIGRATE "request_watches" TABLE
ALTER TABLE "request_watches" ADD COLUMN IF NOT EXISTS user_employee_id VARCHAR(100);

UPDATE "request_watches" rw
SET user_employee_id = COALESCE(
    (SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(rw.user_email) LIMIT 1),
    rw.user_email
);

-- Re-apply UNIQUE constraint for (user_email, request_id) using the new employee_id column
ALTER TABLE "request_watches" DROP CONSTRAINT IF EXISTS request_watches_user_email_request_id_key;
ALTER TABLE "request_watches" DROP COLUMN IF EXISTS user_email;
ALTER TABLE "request_watches" RENAME COLUMN user_employee_id TO user_email;
ALTER TABLE "request_watches" ADD CONSTRAINT request_watches_user_email_request_id_key UNIQUE(user_email, request_id);

-- 3. MIGRATE "push_subscriptions" TABLE
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS user_employee_id VARCHAR(100);

UPDATE "push_subscriptions" ps
SET user_employee_id = COALESCE(
    (SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(ps.user_email) LIMIT 1),
    ps.user_email
);

ALTER TABLE "push_subscriptions" DROP COLUMN IF EXISTS user_email;
ALTER TABLE "push_subscriptions" RENAME COLUMN user_employee_id TO user_email;

-- 4. MIGRATE "comment" TABLE
-- Map tag column
SELECT public.safe_resolve_column_email_list('comment', 'tag');

-- Map comment_by, created_by, updated_by
SELECT public.safe_update_column_email_to_emp_id('comment', 'comment_by');
SELECT public.safe_update_column_email_to_emp_id('comment', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('comment', 'updated_by');

-- 5. MIGRATE "ticket_comment" TABLE
SELECT public.safe_update_column_email_to_emp_id('ticket_comment', 'comment_by');
SELECT public.safe_update_column_email_to_emp_id('ticket_comment', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('ticket_comment', 'updated_by');

-- 6. MIGRATE "request" TABLE
-- Map sr_owner (TEXT[] array)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'request' AND column_name = 'sr_owner'
    ) THEN
        UPDATE "request" r
        SET sr_owner = ARRAY(
            SELECT DISTINCT COALESCE(e.employee_id, o)
            FROM UNNEST(r.sr_owner) o
            LEFT JOIN employee e ON LOWER(e.email) = LOWER(o)
        )
        WHERE sr_owner IS NOT NULL AND ARRAY_LENGTH(sr_owner, 1) > 0;
    END IF;
END $$;

-- Map requester, sr_creater, tier_1_approval, tier_2_approval, tier_3_approval, created_by, updated_by
SELECT public.safe_update_column_email_to_emp_id('request', 'requester');
SELECT public.safe_update_column_email_to_emp_id('request', 'sr_creater');
SELECT public.safe_update_column_email_to_emp_id('request', 'tier_1_approval');
SELECT public.safe_update_column_email_to_emp_id('request', 'tier_2_approval');
SELECT public.safe_update_column_email_to_emp_id('request', 'tier_3_approval');
SELECT public.safe_update_column_email_to_emp_id('request', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('request', 'updated_by');

-- 7. MIGRATE "ticket" TABLE
SELECT public.safe_update_column_email_to_emp_id('ticket', 'requester');
SELECT public.safe_update_column_email_to_emp_id('ticket', 'sr_creater');
SELECT public.safe_update_column_email_to_emp_id('ticket', 'tier_1_approval');
SELECT public.safe_update_column_email_to_emp_id('ticket', 'tier_2_approval');
SELECT public.safe_update_column_email_to_emp_id('ticket', 'tier_3_approval');
SELECT public.safe_update_column_email_to_emp_id('ticket', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('ticket', 'updated_by');

-- 8. MIGRATE "policy_and_program" TABLE
SELECT public.safe_resolve_column_email_list('policy_and_program', 'sr_owner');
SELECT public.safe_resolve_column_email_list('policy_and_program', 'tier1_approval');
SELECT public.safe_resolve_column_email_list('policy_and_program', 'tier2_approval');
SELECT public.safe_resolve_column_email_list('policy_and_program', 'tier3_approval');

-- 9. MIGRATE "ticket_type" TABLE
SELECT public.safe_resolve_column_email_list('ticket_type', 'sr_owner');

-- 10. MIGRATE CHILD TRANSACTION TABLES
SELECT public.safe_update_column_email_to_emp_id('asset', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('asset', 'updated_by');
SELECT public.safe_update_column_email_to_emp_id('asset', 'current_owner');

SELECT public.safe_update_column_email_to_emp_id('contract', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('contract', 'updated_by');
SELECT public.safe_update_column_email_to_emp_id('contract', 'contract_owner');

SELECT public.safe_update_column_email_to_emp_id('expense', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('expense', 'updated_by');

SELECT public.safe_update_column_email_to_emp_id('invoice', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('invoice', 'updated_by');

SELECT public.safe_update_column_email_to_emp_id('mtr', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('mtr', 'updated_by');

SELECT public.safe_update_column_email_to_emp_id('payment', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('payment', 'updated_by');

SELECT public.safe_update_column_email_to_emp_id('service', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('service', 'updated_by');

-- Clean up helpers
DROP FUNCTION IF EXISTS public.resolve_emails_to_employee_ids(text);
DROP FUNCTION IF EXISTS public.safe_update_column_email_to_emp_id(text, text);
DROP FUNCTION IF EXISTS public.safe_resolve_column_email_list(text, text);

COMMIT;
