-- The session token hash is looked up on every authenticated request and must
-- be unique. Added as a separate migration to keep earlier migrations stable.
CREATE UNIQUE INDEX idx_sessions_token_hash ON sessions(session_token_hash);
