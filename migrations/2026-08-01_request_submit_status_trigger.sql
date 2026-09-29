CREATE OR REPLACE FUNCTION public.enforce_request_submit_status()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_request_submit_status ON public.request;

CREATE TRIGGER trg_request_submit_status
BEFORE INSERT OR UPDATE OF sr_status
ON public.request
FOR EACH ROW
EXECUTE FUNCTION public.enforce_request_submit_status();
