-- Migration 007: Rename independent_id to password
BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'employee' 
        AND column_name = 'independent_id'
    ) THEN
        ALTER TABLE public.employee RENAME COLUMN independent_id TO password;
    END IF;
END $$;

COMMIT;
