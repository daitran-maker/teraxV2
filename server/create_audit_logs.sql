-- 1. Create the centralized audit_logs table if not exists
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

-- Index for fast lookup when querying history of a specific record
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
-- Index for search query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 2. Create the unified dynamic trigger function
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_pk_col TEXT;
    v_record_id TEXT;
    v_action TEXT;
    user_val TEXT;
    changed_fields JSONB;
BEGIN
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
            user_val := COALESCE(OLD.updated_by, OLD.created_by, 'system');
        ELSE
            user_val := COALESCE(NEW.updated_by, NEW.created_by, 'system');
        END IF;
    END IF;

    -- Exclude meta columns to prevent noise
    -- We do NOT include 'log' column here as it's no longer modified
    IF (TG_OP = 'INSERT') THEN
        v_action := 'created record';
        
        SELECT jsonb_object_agg(key, jsonb_build_object('old', null, 'new', value)) INTO changed_fields
        FROM jsonb_each(to_jsonb(NEW))
        WHERE key NOT IN ('log', 'updated_date', 'updated_by', 'created_date', 'created_by') AND value IS NOT NULL;

        INSERT INTO audit_logs (table_name, record_id, action, changes, changed_by)
        VALUES (TG_TABLE_NAME, v_record_id, v_action, COALESCE(changed_fields, '{}'::jsonb), user_val);

    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'updated record';
        
        -- Set updated_date automatically in NEW record if columns exist
        BEGIN
            NEW.updated_date := CURRENT_TIMESTAMP;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore if column doesn't exist
        END;

        SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val)) INTO changed_fields
        FROM (
            SELECT o.key, o.value as old_val, n.value as new_val
            FROM jsonb_each(to_jsonb(OLD)) o
            JOIN jsonb_each(to_jsonb(NEW)) n ON o.key = n.key
            WHERE o.value IS DISTINCT FROM n.value
              AND o.key NOT IN ('log', 'updated_date', 'updated_by', 'created_date', 'created_by')
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
$$ LANGUAGE plpgsql;

-- 3. Re-apply trigger to all relevant tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'log' AND table_schema = 'public'
        INTERSECT
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_date' AND table_schema = 'public'
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_log ON %I', r.table_name);
        EXECUTE format('CREATE TRIGGER trg_audit_log BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_log_trigger()', r.table_name);
    END LOOP;
END;
$$;
