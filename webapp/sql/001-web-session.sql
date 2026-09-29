-- Apply ONLY to a dedicated, restricted web-session database (never the RIMMA customer schema).
CREATE TABLE IF NOT EXISTS rimma_web_sessions (
  sid_hash text PRIMARY KEY CHECK (sid_hash ~ '^[a-f0-9]{64}$'),
  iv bytea NOT NULL,
  ciphertext bytea NOT NULL,
  valid_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rimma_web_sessions_expiry ON rimma_web_sessions(valid_until);
CREATE TABLE IF NOT EXISTS rimma_web_login_attempts (
  attempt_hash text PRIMARY KEY CHECK (attempt_hash ~ '^[a-f0-9]{64}$'),
  failures integer NOT NULL CHECK (failures >= 0),
  window_started timestamptz NOT NULL,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rimma_web_login_attempts_expiry ON rimma_web_login_attempts(updated_at);
-- Create a separate runtime DB role with only SELECT/INSERT/UPDATE/DELETE
-- on these two tables; keep CREATE/ALTER permissions on a migration-only role.
