-- ==============================================================================
-- PATCH MIGRATION: Convert email → employee_id in transaction tables (data only)
-- Run on crcdevdb (and crc_helpdesk_db if also still email)
-- ==============================================================================

BEGIN;

-- 1. request table
UPDATE "request" r
SET requester = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(r.requester) LIMIT 1), r.requester)
WHERE r.requester LIKE '%@%';

UPDATE "request" r
SET sr_creater = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(r.sr_creater) LIMIT 1), r.sr_creater)
WHERE r.sr_creater LIKE '%@%';

UPDATE "request" r
SET tier_1_approval = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(r.tier_1_approval) LIMIT 1), r.tier_1_approval)
WHERE r.tier_1_approval LIKE '%@%';

UPDATE "request" r
SET tier_2_approval = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(r.tier_2_approval) LIMIT 1), r.tier_2_approval)
WHERE r.tier_2_approval LIKE '%@%';

UPDATE "request" r
SET tier_3_approval = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(r.tier_3_approval) LIMIT 1), r.tier_3_approval)
WHERE r.tier_3_approval LIKE '%@%';

UPDATE "request" r
SET created_by = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(r.created_by) LIMIT 1), r.created_by)
WHERE r.created_by LIKE '%@%';

UPDATE "request" r
SET updated_by = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(r.updated_by) LIMIT 1), r.updated_by)
WHERE r.updated_by LIKE '%@%';

-- sr_owner is TEXT[] - convert each element
UPDATE "request" r
SET sr_owner = ARRAY(
    SELECT DISTINCT COALESCE(e.employee_id, o)
    FROM UNNEST(r.sr_owner) o
    LEFT JOIN employee e ON LOWER(e.email) = LOWER(o)
)
WHERE EXISTS (SELECT 1 FROM UNNEST(sr_owner) x WHERE x LIKE '%@%');

-- 2. comment table
UPDATE "comment" c
SET comment_by = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(c.comment_by) LIMIT 1), c.comment_by)
WHERE c.comment_by LIKE '%@%';

UPDATE "comment" c
SET created_by = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(c.created_by) LIMIT 1), c.created_by)
WHERE c.created_by LIKE '%@%';

UPDATE "comment" c
SET updated_by = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(c.updated_by) LIMIT 1), c.updated_by)
WHERE c.updated_by IS NOT NULL AND c.updated_by LIKE '%@%';

-- tag column: comma-separated emails → employee_ids
UPDATE "comment"
SET tag = (
    SELECT string_agg(COALESCE(e.employee_id, t.val), ',' ORDER BY t.idx)
    FROM (
        SELECT ROW_NUMBER() OVER () as idx, TRIM(val) as val
        FROM regexp_split_to_table("comment".tag, ',') val
    ) t
    LEFT JOIN employee e ON LOWER(e.email) = LOWER(t.val)
)
WHERE tag IS NOT NULL AND tag LIKE '%@%';

-- 3. ticket_comment
UPDATE "ticket_comment" c
SET comment_by = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(c.comment_by) LIMIT 1), c.comment_by)
WHERE c.comment_by LIKE '%@%';

UPDATE "ticket_comment" c
SET created_by = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(c.created_by) LIMIT 1), c.created_by)
WHERE c.created_by LIKE '%@%';

-- 4. policy_and_program
UPDATE "policy_and_program"
SET tier1_approval = (
    SELECT string_agg(COALESCE(e.employee_id, t.val), ',' ORDER BY t.idx)
    FROM (SELECT ROW_NUMBER() OVER () as idx, TRIM(REPLACE(REPLACE(val, '[', ''), ']', '')) as val FROM regexp_split_to_table(tier1_approval, ',') val) t
    LEFT JOIN employee e ON LOWER(e.email) = LOWER(t.val)
)
WHERE tier1_approval LIKE '%@%';

UPDATE "policy_and_program"
SET tier2_approval = (
    SELECT string_agg(COALESCE(e.employee_id, t.val), ',' ORDER BY t.idx)
    FROM (SELECT ROW_NUMBER() OVER () as idx, TRIM(REPLACE(REPLACE(val, '[', ''), ']', '')) as val FROM regexp_split_to_table(tier2_approval, ',') val) t
    LEFT JOIN employee e ON LOWER(e.email) = LOWER(t.val)
)
WHERE tier2_approval LIKE '%@%';

UPDATE "policy_and_program"
SET tier3_approval = (
    SELECT string_agg(COALESCE(e.employee_id, t.val), ',' ORDER BY t.idx)
    FROM (SELECT ROW_NUMBER() OVER () as idx, TRIM(REPLACE(REPLACE(val, '[', ''), ']', '')) as val FROM regexp_split_to_table(tier3_approval, ',') val) t
    LEFT JOIN employee e ON LOWER(e.email) = LOWER(t.val)
)
WHERE tier3_approval LIKE '%@%';

UPDATE "policy_and_program"
SET sr_owner = (
    SELECT string_agg(COALESCE(e.employee_id, t.val), ',' ORDER BY t.idx)
    FROM (SELECT ROW_NUMBER() OVER () as idx, TRIM(REPLACE(REPLACE(val, '[', ''), ']', '')) as val FROM regexp_split_to_table(sr_owner, ',') val) t
    LEFT JOIN employee e ON LOWER(e.email) = LOWER(t.val)
)
WHERE sr_owner LIKE '%@%';

-- 5. ticket_type sr_owner
UPDATE "ticket_type"
SET sr_owner = (
    SELECT string_agg(COALESCE(e.employee_id, t.val), ',' ORDER BY t.idx)
    FROM (SELECT ROW_NUMBER() OVER () as idx, TRIM(REPLACE(REPLACE(val, '[', ''), ']', '')) as val FROM regexp_split_to_table(sr_owner, ',') val) t
    LEFT JOIN employee e ON LOWER(e.email) = LOWER(t.val)
)
WHERE sr_owner LIKE '%@%';

-- 6. ticket table
UPDATE "ticket" t
SET requester = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(t.requester) LIMIT 1), t.requester)
WHERE t.requester LIKE '%@%';

UPDATE "ticket" t
SET sr_creater = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(t.sr_creater) LIMIT 1), t.sr_creater)
WHERE t.sr_creater LIKE '%@%';

UPDATE "ticket" t
SET tier_1_approval = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(t.tier_1_approval) LIMIT 1), t.tier_1_approval)
WHERE t.tier_1_approval LIKE '%@%';

UPDATE "ticket" t
SET tier_2_approval = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(t.tier_2_approval) LIMIT 1), t.tier_2_approval)
WHERE t.tier_2_approval LIKE '%@%';

UPDATE "ticket" t
SET tier_3_approval = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(t.tier_3_approval) LIMIT 1), t.tier_3_approval)
WHERE t.tier_3_approval LIKE '%@%';

-- 7. asset, contract, expense, invoice, mtr, payment, service - created_by/updated_by
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['asset','contract','expense','invoice','mtr','payment','service']
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name='created_by') THEN
            EXECUTE format('UPDATE %I SET created_by = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(created_by) LIMIT 1), created_by) WHERE created_by LIKE ''%%@%%''', tbl);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name='updated_by') THEN
            EXECUTE format('UPDATE %I SET updated_by = COALESCE((SELECT employee_id FROM employee e WHERE LOWER(e.email) = LOWER(updated_by) LIMIT 1), updated_by) WHERE updated_by LIKE ''%%@%%''', tbl);
        END IF;
    END LOOP;
END $$;

COMMIT;
