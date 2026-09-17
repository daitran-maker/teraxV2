-- Migration 006: Dual Authentication & Universal Employee ID Support
-- Compatible migration for crc_app template and all tenant databases (terax1 to terax15)

BEGIN;

-- 1. Add employee_id column if not exists
ALTER TABLE public.employee ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);

-- 2. Add username column if not exists
ALTER TABLE public.employee ADD COLUMN IF NOT EXISTS username VARCHAR(100);

-- 3. Auto-populate employee_id for existing records where employee_id is null
WITH numbered AS (
  SELECT email, 'EMP-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_date ASC, email ASC)::text, 4, '0') AS generated_id
  FROM public.employee
  WHERE employee_id IS NULL
)
UPDATE public.employee e
SET employee_id = n.generated_id
FROM numbered n
WHERE e.email = n.email AND e.employee_id IS NULL;

-- 4. Auto-populate username for existing records if null
UPDATE public.employee
SET username = LOWER(SPLIT_PART(email, '@', 1))
WHERE username IS NULL AND email IS NOT NULL;

-- 5. Drop old Primary Key constraint on email
ALTER TABLE public.employee DROP CONSTRAINT IF EXISTS employee_pkey CASCADE;

-- 6. Set employee_id NOT NULL and set as new PRIMARY KEY
ALTER TABLE public.employee ALTER COLUMN employee_id SET NOT NULL;
ALTER TABLE public.employee ADD PRIMARY KEY (employee_id);

-- 7. Make email NULLABLE (so username-only accounts can be created)
ALTER TABLE public.employee ALTER COLUMN email DROP NOT NULL;

-- 8. Add Unique Constraints for email and username (allowing nulls)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_email_unique_key') THEN
        ALTER TABLE public.employee ADD CONSTRAINT employee_email_unique_key UNIQUE (email);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_username_unique_key') THEN
        ALTER TABLE public.employee ADD CONSTRAINT employee_username_unique_key UNIQUE (username);
    END IF;
END $$;

COMMIT;
