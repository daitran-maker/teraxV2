BEGIN;

-- 1) Audit trigger function for all business tables
CREATE OR REPLACE FUNCTION public.trg_set_audit_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor text;
  changed jsonb;
BEGIN
  actor := COALESCE(current_setting('app.current_user', true), NEW.updated_by, NEW.created_by, 'system');

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, actor);
    NEW.created_date := COALESCE(NEW.created_date, timezone('Asia/Bangkok', now()));
    NEW.updated_by := COALESCE(NEW.updated_by, actor);
    NEW.updated_date := COALESCE(NEW.updated_date, timezone('Asia/Bangkok', now()));
    NEW.logs := COALESCE(NEW.logs, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'at', timezone('Asia/Bangkok', now()),
        'by', actor,
        'action', 'created'
      )
    );
    RETURN NEW;
  END IF;

  NEW.created_by := OLD.created_by;
  NEW.created_date := OLD.created_date;
  NEW.updated_by := COALESCE(NEW.updated_by, actor);
  NEW.updated_date := timezone('Asia/Bangkok', now());

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
      'at', timezone('Asia/Bangkok', now()),
      'by', actor,
      'action', 'updated',
      'changes', changed
    )
  );

  RETURN NEW;
END;
$$;

-- 2) Add mandatory audit columns + logs JSONB to all public base tables
DO $$
DECLARE
  tbl text;
  has_log_column boolean;
  has_logs_column boolean;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by text', tbl);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_date timestamp without time zone', tbl);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by text', tbl);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_date timestamp without time zone', tbl);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS logs jsonb DEFAULT ''[]''::jsonb NOT NULL', tbl);

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'log'
    ) INTO has_log_column;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'logs'
    ) INTO has_logs_column;

    IF has_log_column AND has_logs_column THEN
      EXECUTE format($f$
        UPDATE %I
        SET logs = CASE
          WHEN COALESCE(log::text, '') = '' THEN COALESCE(logs, '[]'::jsonb)
          ELSE COALESCE(logs, '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object(
              'at', timezone('Asia/Bangkok', now()),
              'by', 'system',
              'action', 'legacy_log_import',
              'message', log
            )
          )
        END
      $f$, tbl);
    END IF;

    EXECUTE format($f$
      UPDATE %I
      SET created_by = COALESCE(created_by, 'system'),
          created_date = COALESCE(created_date, timezone('Asia/Bangkok', now())),
          updated_by = COALESCE(updated_by, created_by, 'system'),
          updated_date = COALESCE(updated_date, timezone('Asia/Bangkok', now())),
          logs = COALESCE(logs, '[]'::jsonb)
    $f$, tbl);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_fields ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_fields BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.trg_set_audit_fields()',
      tbl
    );
  END LOOP;
END $$;

COMMIT;
