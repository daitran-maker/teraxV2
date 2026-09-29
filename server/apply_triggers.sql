CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields jsonb;
    log_entry jsonb;
    new_json jsonb;
    user_val text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        new_json = to_jsonb(NEW);
        user_val = COALESCE(new_json->>'created_by', new_json->>'updated_by', 'system');
        
        -- Build changes object as {old: null, new: value}
        SELECT jsonb_object_agg(key, jsonb_build_object('old', null, 'new', value)) INTO changed_fields
        FROM jsonb_each(new_json)
        WHERE key NOT IN ('updated_date', 'log', 'updated_by', 'created_date', 'created_by', 'notification_logs') AND value IS NOT NULL;

        log_entry = jsonb_build_object(
            'timestamp', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'user', user_val,
            'action', 'created record',
            'changes', COALESCE(changed_fields, '{}'::jsonb)
        );
        NEW.log = jsonb_build_array(log_entry);
    ELSIF TG_OP = 'UPDATE' THEN
        -- Set updated_date to current timestamp
        NEW.updated_date = CURRENT_TIMESTAMP;

        -- Calculate differences as {old: old_val, new: new_val}
        SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val)) INTO changed_fields
        FROM (
            SELECT o.key, o.value as old_val, n.value as new_val
            FROM jsonb_each(to_jsonb(OLD)) o
            JOIN jsonb_each(to_jsonb(NEW)) n ON o.key = n.key
            WHERE o.value IS DISTINCT FROM n.value
              AND o.key NOT IN ('updated_date', 'log', 'updated_by', 'created_date', 'created_by', 'notification_logs')
        ) t;

        -- Only append log if there are actual changes
        IF changed_fields IS NOT NULL AND changed_fields != '{}'::jsonb THEN
            DECLARE
                old_len int = 0;
                new_len int = 0;
            BEGIN
                IF OLD.log IS NOT NULL AND jsonb_typeof(OLD.log) = 'array' THEN
                    old_len = jsonb_array_length(OLD.log);
                END IF;
                IF NEW.log IS NOT NULL AND jsonb_typeof(NEW.log) = 'array' THEN
                    new_len = jsonb_array_length(NEW.log);
                END IF;

                IF new_len > old_len THEN
                    -- A manual log was appended. Let's merge the changed_fields into the last element of NEW.log
                    DECLARE
                        last_idx int = new_len - 1;
                        last_entry jsonb = NEW.log -> last_idx;
                    BEGIN
                        IF last_entry ? 'changes' THEN
                            NEW.log = jsonb_set(NEW.log, array[last_idx::text], last_entry || jsonb_build_object('changes', (last_entry->'changes') || changed_fields));
                        ELSE
                            NEW.log = jsonb_set(NEW.log, array[last_idx::text], last_entry || jsonb_build_object('changes', changed_fields));
                        END IF;
                    END;
                ELSE
                    -- No manual log was appended. Create a generic "updated record" log entry.
                    log_entry = jsonb_build_object(
                        'timestamp', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                        'user', COALESCE(NEW.updated_by, OLD.updated_by, 'system'),
                        'action', 'updated record',
                        'changes', changed_fields
                    );
                    NEW.log = COALESCE(NEW.log, OLD.log, '[]'::jsonb) || jsonb_build_array(log_entry);
                END IF;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Apply trigger to all tables that have both 'log' and 'updated_date' columns
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
        EXECUTE format('CREATE TRIGGER trg_audit_log BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION audit_log_trigger()', r.table_name);
    END LOOP;
END;
$$;

