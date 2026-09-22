-- ==============================================================================
-- DATABASE MIGRATION: UNIFIED & FIXED IDENTITY TRANSITION (EMAIL -> EMPLOYEE_ID)
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
            IF r.email LIKE '%@%' THEN
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
                    IF result_str != '' THEN
                        result_str := result_str || ',' || r.email;
                    ELSE
                        result_str := r.email;
                    END IF;
                END IF;
            ELSE
                -- Already employee_id format
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

-- Helper to safely update columns from email to employee_id if they exist
CREATE OR REPLACE FUNCTION public.safe_update_column_email_to_emp_id(tbl_name text, col_name text)
RETURNS void AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = tbl_name AND column_name = col_name
    ) THEN
        EXECUTE format(
            'UPDATE %I SET %I = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(%I) LIMIT 1), %I) WHERE %I LIKE ''%%@%%''',
            tbl_name, col_name, col_name, col_name, col_name
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
            'UPDATE %I SET %I = public.resolve_emails_to_employee_ids(%I) WHERE %I LIKE ''%%@%%''',
            tbl_name, col_name, col_name, col_name
        );
    END IF;
END;
$$ LANGUAGE plpgsql;


-- 0. MIGRATE PRIMARY KEY OF employee TABLE IF IT IS STILL email
DO $$
DECLARE
    pk_columns text;
BEGIN
    -- Check what column the primary key employee_pkey is on
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_pkey' AND conrelid = 'public.employee'::regclass) THEN
        SELECT string_agg(a.attname, ',') INTO pk_columns
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conname = 'employee_pkey' AND c.conrelid = 'public.employee'::regclass;
        
        IF pk_columns = 'email' THEN
            -- Drop foreign key that references employee(email) first
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_direct_manager_fkey') THEN
                ALTER TABLE "employee" DROP CONSTRAINT "employee_direct_manager_fkey";
            END IF;
            
            -- Drop the email-based primary key constraint
            ALTER TABLE "employee" DROP CONSTRAINT "employee_pkey";
            
            -- Add the employee_id-based primary key constraint
            ALTER TABLE "employee" ADD CONSTRAINT employee_pkey PRIMARY KEY (employee_id);
        END IF;
    END IF;
END $$;


-- 1. MIGRATE "notification" TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'notification') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'notification' AND column_name = 'user_email') AND 
           NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'notification' AND column_name = 'user_employee_id') THEN
            ALTER TABLE "notification" RENAME COLUMN user_email TO user_employee_id;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'notification' AND column_name = 'user_email') AND 
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'notification' AND column_name = 'user_employee_id') THEN
            UPDATE "notification" SET user_employee_id = COALESCE(user_employee_id, user_email);
            ALTER TABLE "notification" DROP COLUMN user_email;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'notification' AND column_name = 'user_employee_id') THEN
            ALTER TABLE "notification" ADD COLUMN user_employee_id VARCHAR(255);
        END IF;
    END IF;
END $$;
SELECT public.safe_update_column_email_to_emp_id('notification', 'user_employee_id');


-- 2. MIGRATE "request_watches" TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'request_watches') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'request_watches' AND column_name = 'user_email') AND 
           NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'request_watches' AND column_name = 'user_employee_id') THEN
            ALTER TABLE "request_watches" DROP CONSTRAINT IF EXISTS request_watches_user_email_request_id_key;
            ALTER TABLE "request_watches" RENAME COLUMN user_email TO user_employee_id;
            ALTER TABLE "request_watches" ADD CONSTRAINT request_watches_user_employee_id_request_id_key UNIQUE(user_employee_id, request_id);
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'request_watches' AND column_name = 'user_email') AND 
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'request_watches' AND column_name = 'user_employee_id') THEN
            ALTER TABLE "request_watches" DROP CONSTRAINT IF EXISTS request_watches_user_email_request_id_key;
            UPDATE "request_watches" SET user_employee_id = COALESCE(user_employee_id, user_email);
            ALTER TABLE "request_watches" DROP COLUMN user_email;
            ALTER TABLE "request_watches" DROP CONSTRAINT IF EXISTS request_watches_user_employee_id_request_id_key;
            ALTER TABLE "request_watches" ADD CONSTRAINT request_watches_user_employee_id_request_id_key UNIQUE(user_employee_id, request_id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'request_watches' AND column_name = 'user_employee_id') THEN
            ALTER TABLE "request_watches" ADD COLUMN user_employee_id VARCHAR(255);
            ALTER TABLE "request_watches" ADD CONSTRAINT request_watches_user_employee_id_request_id_key UNIQUE(user_employee_id, request_id);
        END IF;
    END IF;
END $$;
SELECT public.safe_update_column_email_to_emp_id('request_watches', 'user_employee_id');


-- 3. MIGRATE "push_subscriptions" TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name = 'push_subscriptions') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'push_subscriptions' AND column_name = 'user_email') AND 
           NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'push_subscriptions' AND column_name = 'user_employee_id') THEN
            ALTER TABLE "push_subscriptions" RENAME COLUMN user_email TO user_employee_id;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'push_subscriptions' AND column_name = 'user_email') AND 
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'push_subscriptions' AND column_name = 'user_employee_id') THEN
            UPDATE "push_subscriptions" SET user_employee_id = COALESCE(user_employee_id, user_email);
            ALTER TABLE "push_subscriptions" DROP COLUMN user_email;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'push_subscriptions' AND column_name = 'user_employee_id') THEN
            ALTER TABLE "push_subscriptions" ADD COLUMN user_employee_id VARCHAR(255);
        END IF;
    END IF;
END $$;
SELECT public.safe_update_column_email_to_emp_id('push_subscriptions', 'user_employee_id');


-- 4. RECREATE employee_direct_manager_fkey REFERENCING employee_id INSTEAD OF email
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_direct_manager_fkey') THEN
        ALTER TABLE "employee" DROP CONSTRAINT "employee_direct_manager_fkey";
    END IF;
END $$;

UPDATE "employee" emp
SET direct_manager = COALESCE((SELECT employee_id FROM employee mgr WHERE LOWER(mgr.email) = LOWER(emp.direct_manager) LIMIT 1), emp.direct_manager)
WHERE emp.direct_manager LIKE '%@%';

ALTER TABLE "employee"
    ADD CONSTRAINT employee_direct_manager_fkey FOREIGN KEY (direct_manager) REFERENCES public.employee(employee_id) ON DELETE SET NULL;


-- 5. MIGRATE TRANSACTION & RELATED TABLES
SELECT public.safe_update_column_email_to_emp_id('comment', 'comment_by');
SELECT public.safe_update_column_email_to_emp_id('comment', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('comment', 'updated_by');
SELECT public.safe_resolve_column_email_list('comment', 'tag');

SELECT public.safe_update_column_email_to_emp_id('ticket_comment', 'comment_by');
SELECT public.safe_update_column_email_to_emp_id('ticket_comment', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('ticket_comment', 'updated_by');

-- request table
SELECT public.safe_update_column_email_to_emp_id('request', 'requester');
SELECT public.safe_update_column_email_to_emp_id('request', 'sr_creater');
SELECT public.safe_update_column_email_to_emp_id('request', 'tier_1_approval');
SELECT public.safe_update_column_email_to_emp_id('request', 'tier_2_approval');
SELECT public.safe_update_column_email_to_emp_id('request', 'tier_3_approval');
SELECT public.safe_update_column_email_to_emp_id('request', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('request', 'updated_by');
SELECT public.safe_update_column_email_to_emp_id('request', 'policy_lead');

-- sr_owner is TEXT[] array in request
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

-- ticket table
SELECT public.safe_update_column_email_to_emp_id('ticket', 'requester');
SELECT public.safe_update_column_email_to_emp_id('ticket', 'sr_creater');
SELECT public.safe_update_column_email_to_emp_id('ticket', 'tier_1_approval');
SELECT public.safe_update_column_email_to_emp_id('ticket', 'tier_2_approval');
SELECT public.safe_update_column_email_to_emp_id('ticket', 'tier_3_approval');
SELECT public.safe_update_column_email_to_emp_id('ticket', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('ticket', 'updated_by');

-- policy_and_program table
SELECT public.safe_resolve_column_email_list('policy_and_program', 'sr_owner');
SELECT public.safe_resolve_column_email_list('policy_and_program', 'tier1_approval');
SELECT public.safe_resolve_column_email_list('policy_and_program', 'tier2_approval');
SELECT public.safe_resolve_column_email_list('policy_and_program', 'tier3_approval');

-- ticket_type table
SELECT public.safe_resolve_column_email_list('ticket_type', 'sr_owner');

-- Other transaction tables
SELECT public.safe_update_column_email_to_emp_id('asset', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('asset', 'updated_by');
SELECT public.safe_update_column_email_to_emp_id('asset', 'current_owner');

SELECT public.safe_update_column_email_to_emp_id('contract', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('contract', 'updated_by');
SELECT public.safe_update_column_email_to_emp_id('contract', 'contract_owner');

SELECT public.safe_update_column_email_to_emp_id('expense', 'employee');
SELECT public.safe_update_column_email_to_emp_id('expense', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('expense', 'updated_by');

SELECT public.safe_update_column_email_to_emp_id('invoice', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('invoice', 'updated_by');

SELECT public.safe_update_column_email_to_emp_id('mtr', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('mtr', 'updated_by');

SELECT public.safe_update_column_email_to_emp_id('payment', 'employee');
SELECT public.safe_update_column_email_to_emp_id('payment', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('payment', 'updated_by');

SELECT public.safe_update_column_email_to_emp_id('service', 'created_by');
SELECT public.safe_update_column_email_to_emp_id('service', 'updated_by');

SELECT public.safe_update_column_email_to_emp_id('my_location', 'responsible_employee');

-- 6. CLEAN UP HELPER FUNCTIONS
DROP FUNCTION IF EXISTS public.resolve_emails_to_employee_ids(text);
DROP FUNCTION IF EXISTS public.safe_update_column_email_to_emp_id(text, text);
DROP FUNCTION IF EXISTS public.safe_resolve_column_email_list(text, text);

COMMIT;
