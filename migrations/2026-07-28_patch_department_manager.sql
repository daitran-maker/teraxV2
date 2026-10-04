BEGIN;

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

SELECT public.safe_update_column_email_to_emp_id('department', 'manager_email');

DROP FUNCTION IF EXISTS public.safe_update_column_email_to_emp_id(text, text);

COMMIT;
