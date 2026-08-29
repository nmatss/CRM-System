-- Migration 0006: normalized email identity and immutable security audit events.
-- The preflight intentionally fails without altering user rows when two legacy
-- emails collapse to the same LOWER(TRIM(email)) value.
BEGIN IMMEDIATE;

CREATE TEMP TABLE _users_email_normalization_preflight (
  normalized_email TEXT PRIMARY KEY
);
INSERT INTO _users_email_normalization_preflight(normalized_email)
SELECT LOWER(TRIM(email)) FROM users;
DROP TABLE _users_email_normalization_preflight;

CREATE UNIQUE INDEX users_email_normalized_unique
  ON users(LOWER(TRIM(email)));

CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('success', 'failure')),
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE INDEX audit_events_tenant_created_idx ON audit_events(tenant_id, created_at);
CREATE INDEX audit_events_actor_created_idx ON audit_events(actor_user_id, created_at);
CREATE INDEX audit_events_action_created_idx ON audit_events(action, created_at);
CREATE INDEX audit_events_request_id_idx ON audit_events(request_id);

CREATE TRIGGER audit_events_append_only_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;

CREATE TRIGGER audit_events_append_only_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;

INSERT OR IGNORE INTO schema_migrations(version, description)
VALUES('0006', 'Normalized unique user email and immutable security audit events');

COMMIT;
