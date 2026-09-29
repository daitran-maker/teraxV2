CREATE INDEX IF NOT EXISTS idx_request_lower_requester ON request (LOWER(requester));
CREATE INDEX IF NOT EXISTS idx_request_lower_sr_creater ON request (LOWER(sr_creater));
CREATE INDEX IF NOT EXISTS idx_request_sr_owner ON request USING gin (sr_owner);
CREATE INDEX IF NOT EXISTS idx_request_approval_flow ON request USING gin (approval_flow);
