BEGIN;

-- 1) Ensure system_setup table exists for tracking migrations
CREATE TABLE IF NOT EXISTS public.system_setup (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2) Update Audit Trigger Function to strictly store UTC+0
CREATE OR REPLACE FUNCTION public.trg_set_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor text;
  changed jsonb;
  utc_now timestamp without time zone;
  iso_utc_now text;
BEGIN
  actor := COALESCE(current_setting('app.current_user', true), NEW.updated_by, NEW.created_by, 'system');
  utc_now := (now() AT TIME ZONE 'UTC');
  iso_utc_now := to_char(utc_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, actor);
    NEW.created_date := COALESCE(NEW.created_date, utc_now);
    NEW.updated_by := COALESCE(NEW.updated_by, actor);
    NEW.updated_date := COALESCE(NEW.updated_date, utc_now);
    NEW.logs := COALESCE(NEW.logs, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'at', iso_utc_now,
        'by', actor,
        'action', 'created'
      )
    );
    RETURN NEW;
  END IF;

  NEW.created_by := OLD.created_by;
  NEW.created_date := OLD.created_date;
  NEW.updated_by := COALESCE(NEW.updated_by, actor);
  NEW.updated_date := utc_now;

  SELECT COALESCE(
    jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)),
    '{}'::jsonb
  )
  INTO changed
  FROM jsonb_each(to_jsonb(NEW)) n
  JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
  WHERE n.key NOT IN ('created_by', 'created_date', 'updated_by', 'updated_date', 'logs')
    AND n.value IS DISTINCT FROM o.value;

  NEW.logs := COALESCE(OLD.logs, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'at', iso_utc_now,
      'by', actor,
      'action', 'updated',
      'changes', changed
    )
  );

  RETURN NEW;
END;
$$;

-- 3) One-time data conversion for existing tables from Asia/Bangkok (UTC+7) to UTC+0
DO $$
DECLARE
  tbl text;
  already_migrated boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.system_setup WHERE key = 'migration_utc0_standardization' AND value = 'done'
  ) INTO already_migrated;

  IF NOT already_migrated THEN
    FOR tbl IN
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('spatial_ref_sys', 'system_setup')
    LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'created_date'
      ) THEN
        EXECUTE format('UPDATE %I SET created_date = created_date - INTERVAL ''7 hours'' WHERE created_date IS NOT NULL', tbl);
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'updated_date'
      ) THEN
        EXECUTE format('UPDATE %I SET updated_date = updated_date - INTERVAL ''7 hours'' WHERE updated_date IS NOT NULL', tbl);
      END IF;
    END LOOP;

    -- Adjust request table specific timestamp columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'request') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'request' AND column_name = 'sr_created_date') THEN
        EXECUTE 'UPDATE request SET sr_created_date = sr_created_date - INTERVAL ''7 hours'' WHERE sr_created_date IS NOT NULL';
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'request' AND column_name = 'sr_submitted_date') THEN
        EXECUTE 'UPDATE request SET sr_submitted_date = sr_submitted_date - INTERVAL ''7 hours'' WHERE sr_submitted_date IS NOT NULL';
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'request' AND column_name = 'sr_close_date') THEN
        EXECUTE 'UPDATE request SET sr_close_date = sr_close_date - INTERVAL ''7 hours'' WHERE sr_close_date IS NOT NULL';
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'request' AND column_name = 'process_start_date') THEN
        EXECUTE 'UPDATE request SET process_start_date = process_start_date - INTERVAL ''7 hours'' WHERE process_start_date IS NOT NULL';
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'request' AND column_name = 'process_end_date') THEN
        EXECUTE 'UPDATE request SET process_end_date = process_end_date - INTERVAL ''7 hours'' WHERE process_end_date IS NOT NULL';
      END IF;
    END IF;

    INSERT INTO public.system_setup (key, value, updated_at)
    VALUES ('migration_utc0_standardization', 'done', (now() AT TIME ZONE 'UTC'))
    ON CONFLICT (key) DO UPDATE SET value = 'done', updated_at = (now() AT TIME ZONE 'UTC');
  END IF;
END $$;

COMMIT;
