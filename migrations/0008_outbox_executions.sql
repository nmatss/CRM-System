-- Migration 0008 — Durable outbox, campaign executions and automation executions
--
-- Implements ADR 0001. Additive only: no table is rewritten, no column is
-- dropped and every legacy column keeps working. Safe to run more than once.
--
-- Rollback/containment: the application still boots with these objects present
-- and unused, so a rollback of the application binary needs no schema change.
-- If the objects must be removed, drop them in reverse dependency order:
--   automation_executions, campaign_recipients, campaign_executions, outbox_jobs.
-- The additive columns on customers/automations must stay: dropping them would
-- rewrite tables that older binaries still read.

PRAGMA foreign_keys = ON;

BEGIN;

-- ---------------------------------------------------------------- outbox jobs
CREATE TABLE IF NOT EXISTS outbox_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_version INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'retry_wait', 'succeeded', 'dead_letter', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  available_at TEXT NOT NULL DEFAULT (datetime('now')),
  lease_owner TEXT,
  lease_expires_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS outbox_jobs_tenant_idempotency_unique
  ON outbox_jobs (tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS outbox_jobs_claim_idx ON outbox_jobs (status, available_at);
CREATE INDEX IF NOT EXISTS outbox_jobs_tenant_status_idx ON outbox_jobs (tenant_id, status);
CREATE INDEX IF NOT EXISTS outbox_jobs_lease_idx ON outbox_jobs (lease_expires_at);

-- ------------------------------------------------------- campaign executions
CREATE TABLE IF NOT EXISTS campaign_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  audience TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'processing', 'completed', 'failed', 'cancelled')),
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  total_recipients INTEGER NOT NULL DEFAULT 0 CHECK (total_recipients >= 0),
  delivered_count INTEGER NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_executions_tenant_idempotency_unique
  ON campaign_executions (tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS campaign_executions_tenant_campaign_idx
  ON campaign_executions (tenant_id, campaign_id);
CREATE INDEX IF NOT EXISTS campaign_executions_tenant_created_idx
  ON campaign_executions (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id INTEGER NOT NULL REFERENCES campaign_executions(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'failed', 'skipped_opt_out', 'not_configured')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider_message_id TEXT,
  failure_reason TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_execution_customer_unique
  ON campaign_recipients (execution_id, customer_id);
CREATE INDEX IF NOT EXISTS campaign_recipients_tenant_status_idx
  ON campaign_recipients (tenant_id, status);
CREATE INDEX IF NOT EXISTS campaign_recipients_execution_status_idx
  ON campaign_recipients (execution_id, status);

-- ------------------------------------------------------ automation executions
CREATE TABLE IF NOT EXISTS automation_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  automation_id INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  automation_version INTEGER NOT NULL DEFAULT 1,
  trigger_type TEXT NOT NULL,
  trigger_reference TEXT,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS automation_executions_tenant_idempotency_unique
  ON automation_executions (tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS automation_executions_tenant_created_idx
  ON automation_executions (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS automation_executions_automation_idx
  ON automation_executions (automation_id, created_at);

-- --------------------------------------------------------- cross-tenant guards
CREATE TRIGGER IF NOT EXISTS campaign_executions_tenant_guard_insert
BEFORE INSERT ON campaign_executions BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM campaigns WHERE id = NEW.campaign_id AND tenant_id = NEW.tenant_id
  ) THEN RAISE(ABORT, 'campaign execution tenant mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS campaign_recipients_tenant_guard_insert
BEFORE INSERT ON campaign_recipients BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM campaign_executions
    WHERE id = NEW.execution_id AND tenant_id = NEW.tenant_id AND campaign_id = NEW.campaign_id
  ) THEN RAISE(ABORT, 'campaign recipient execution tenant mismatch') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM customers WHERE id = NEW.customer_id AND tenant_id = NEW.tenant_id
  ) THEN RAISE(ABORT, 'campaign recipient customer tenant mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS automation_executions_tenant_guard_insert
BEFORE INSERT ON automation_executions BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM automations WHERE id = NEW.automation_id AND tenant_id = NEW.tenant_id
  ) THEN RAISE(ABORT, 'automation execution tenant mismatch') END;
END;

COMMIT;

-- Additive columns are applied outside the transaction because SQLite rejects
-- ALTER TABLE ADD COLUMN for a column that already exists; the application
-- bootstrap guards each one with a PRAGMA table_info check.
--
-- ALTER TABLE customers ADD COLUMN marketing_opt_out INTEGER NOT NULL DEFAULT 0 CHECK (marketing_opt_out IN (0, 1));
-- ALTER TABLE customers ADD COLUMN marketing_consent_at TEXT;
-- ALTER TABLE automations ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);
-- ALTER TABLE automations ADD COLUMN trigger_type TEXT NOT NULL DEFAULT 'customer.created';
-- ALTER TABLE automations ADD COLUMN action_type TEXT NOT NULL DEFAULT 'notify_customer';
-- ALTER TABLE automations ADD COLUMN action_channel TEXT NOT NULL DEFAULT 'email';
