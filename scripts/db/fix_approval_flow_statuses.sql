-- ==============================================================================
-- Script to normalize and standardize approval_flow JSON in request table
-- ==============================================================================

CREATE OR REPLACE FUNCTION normalize_approval_flow_statuses(flow jsonb, sr_st integer)
RETURNS jsonb AS $$
DECLARE
  v_steps jsonb;
  v_new_steps jsonb;
  v_current_level int := 1;
  v_total_levels int := 1;
  v_elem jsonb;
  v_idx int := 0;
  v_st_raw text;
  v_new_st int;
  v_found_pending boolean := false;
BEGIN
  IF flow IS NULL OR jsonb_typeof(flow) != 'object' OR NOT (flow ? 'steps') THEN
    RETURN flow;
  END IF;

  v_steps := flow->'steps';
  IF jsonb_typeof(v_steps) != 'array' THEN
    RETURN flow;
  END IF;

  v_new_steps := '[]'::jsonb;
  v_total_levels := jsonb_array_length(v_steps);

  FOR v_idx IN 0 .. (v_total_levels - 1) LOOP
    v_elem := v_steps->v_idx;
    v_st_raw := LOWER(TRIM(COALESCE(v_elem->>'status', '')));

    IF v_st_raw IN ('3', 'approved') THEN
      v_new_st := 3;
    ELSIF v_st_raw IN ('4', 'rejected') THEN
      v_new_st := 4;
    ELSIF v_st_raw IN ('2', 'pending', 'pending approval', 'submitted') THEN
      v_new_st := 2;
    ELSE
      -- Not started yet / Draft / 7
      IF v_idx = 0 AND sr_st = 2 AND NOT v_found_pending THEN
        v_new_st := 2; -- Level 1 is pending approval when request is submitted
      ELSE
        v_new_st := 7;
      END IF;
    END IF;

    IF v_new_st = 2 AND NOT v_found_pending THEN
      v_found_pending := true;
      v_current_level := v_idx + 1;
    END IF;

    v_new_steps := v_new_steps || jsonb_build_array(
      jsonb_set(
        v_elem,
        '{status}',
        to_jsonb(v_new_st)
      )
    );
  END LOOP;

  -- Determine current_level if no pending step found
  IF NOT v_found_pending THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_new_steps) s WHERE (s->>'status')::int = 4) THEN
      v_current_level := 1;
    ELSIF (SELECT COUNT(*) FROM jsonb_array_elements(v_new_steps) s WHERE (s->>'status')::int = 3) = v_total_levels THEN
      v_current_level := v_total_levels + 1;
    ELSE
      v_current_level := 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'steps', v_new_steps,
    'total_levels', COALESCE((flow->>'total_levels')::int, v_total_levels),
    'current_level', v_current_level,
    'audit_log', COALESCE(flow->'audit_log', '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql;

-- Apply normalization to all requests
UPDATE request
SET approval_flow = normalize_approval_flow_statuses(approval_flow, sr_status)
WHERE approval_flow IS NOT NULL 
  AND jsonb_typeof(approval_flow) = 'object' 
  AND approval_flow ? 'steps';

-- Update trigger function to ensure future submits promote step 1 to status 2 (integer)
CREATE OR REPLACE FUNCTION public.enforce_request_submit_status()
RETURNS trigger AS $trg$
BEGIN
  IF NEW.sr_status = 2 THEN
    IF NEW.sr_submitted_date IS NULL THEN
      NEW.sr_submitted_date := CURRENT_TIMESTAMP;
    END IF;

    IF NEW.approval_flow IS NOT NULL AND jsonb_typeof(NEW.approval_flow) = 'object' AND NEW.approval_flow ? 'steps' THEN
      NEW.approval_flow := jsonb_set(
        NEW.approval_flow,
        '{steps}',
        (
          SELECT jsonb_agg(
            CASE
              WHEN ord = 1 AND (step->>'status' = '7' OR step->>'status' = '1' OR LOWER(step->>'status') IN ('not started yet', 'not started', 'draft'))
              THEN jsonb_set(step, '{status}', '2'::jsonb, true)
              ELSE step
            END
            ORDER BY ord
          )
          FROM jsonb_array_elements(NEW.approval_flow->'steps') WITH ORDINALITY AS s(step, ord)
        ),
        true
      );
    END IF;
  ELSIF NEW.sr_status = 1 THEN
    NEW.process_status := 7;

    IF NEW.approval_flow IS NOT NULL AND jsonb_typeof(NEW.approval_flow) = 'object' AND NEW.approval_flow ? 'steps' THEN
      NEW.approval_flow := jsonb_set(
        NEW.approval_flow,
        '{steps}',
        (
          SELECT jsonb_agg(
            jsonb_set(
              jsonb_set(
                jsonb_set(step, '{status}', '7'::jsonb, true),
                '{action_by}', 'null'::jsonb, true
              ),
              '{action_date}', 'null'::jsonb, true
            )
            ORDER BY ord
          )
          FROM jsonb_array_elements(NEW.approval_flow->'steps') WITH ORDINALITY AS s(step, ord)
        ),
        true
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$trg$ LANGUAGE plpgsql;
