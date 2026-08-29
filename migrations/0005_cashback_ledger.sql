-- Migration 0005: integer, idempotent and reconcilable cashback ledger.
BEGIN IMMEDIATE;

ALTER TABLE cashback_transactions ADD COLUMN amount_cents INTEGER NOT NULL DEFAULT 0 CHECK(amount_cents >= 0);
ALTER TABLE cashback_transactions ADD COLUMN balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(balance_cents >= 0);
ALTER TABLE cashback_transactions ADD COLUMN idempotency_key TEXT;
ALTER TABLE cashback_transactions ADD COLUMN request_hash TEXT;
ALTER TABLE cashback_transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE cashback_transactions ADD COLUMN reversal_of_id INTEGER REFERENCES cashback_transactions(id);

UPDATE cashback_transactions SET
  amount_cents = CAST(ROUND(amount * 100) AS INTEGER),
  balance_cents = CAST(ROUND(balance * 100) AS INTEGER);

CREATE UNIQUE INDEX cashback_transactions_tenant_idempotency_unique
  ON cashback_transactions(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX cashback_transactions_tenant_reversal_unique
  ON cashback_transactions(tenant_id, reversal_of_id) WHERE reversal_of_id IS NOT NULL;

CREATE TABLE cashback_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(balance_cents >= 0),
  updated_at TEXT DEFAULT(datetime('now')),
  UNIQUE(tenant_id, customer_id)
);

CREATE TABLE cashback_credit_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  credit_transaction_id INTEGER REFERENCES cashback_transactions(id) ON DELETE RESTRICT,
  original_cents INTEGER NOT NULL CHECK(original_cents > 0),
  remaining_cents INTEGER NOT NULL CHECK(remaining_cents >= 0 AND remaining_cents <= original_cents),
  expires_at TEXT,
  created_at TEXT DEFAULT(datetime('now'))
);

CREATE TABLE cashback_debit_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  debit_transaction_id INTEGER NOT NULL REFERENCES cashback_transactions(id) ON DELETE CASCADE,
  credit_lot_id INTEGER NOT NULL REFERENCES cashback_credit_lots(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  UNIQUE(debit_transaction_id, credit_lot_id)
);

CREATE UNIQUE INDEX cashback_accounts_tenant_customer_unique ON cashback_accounts(tenant_id, customer_id);
CREATE INDEX cashback_credit_lots_tenant_customer_expiry_idx ON cashback_credit_lots(tenant_id, customer_id, expires_at);
CREATE UNIQUE INDEX cashback_debit_allocations_transaction_lot_unique ON cashback_debit_allocations(debit_transaction_id, credit_lot_id);

CREATE TRIGGER cashback_transactions_tenant_guard_insert BEFORE INSERT ON cashback_transactions BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback transaction customer tenant mismatch') END;
  SELECT CASE WHEN NEW.rule_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cashback_rules WHERE id=NEW.rule_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback transaction rule tenant mismatch') END;
  SELECT CASE WHEN NEW.order_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback transaction order tenant mismatch') END;
END;
CREATE TRIGGER cashback_transactions_tenant_guard_update BEFORE UPDATE OF tenant_id,customer_id,rule_id,order_id ON cashback_transactions BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback transaction customer tenant mismatch') END;
  SELECT CASE WHEN NEW.rule_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cashback_rules WHERE id=NEW.rule_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback transaction rule tenant mismatch') END;
  SELECT CASE WHEN NEW.order_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback transaction order tenant mismatch') END;
END;

INSERT INTO cashback_accounts(tenant_id, customer_id, balance_cents)
SELECT t.tenant_id, t.customer_id, t.balance_cents
FROM cashback_transactions t
WHERE t.id = (SELECT MAX(t2.id) FROM cashback_transactions t2 WHERE t2.tenant_id=t.tenant_id AND t2.customer_id=t.customer_id);

INSERT INTO cashback_credit_lots(tenant_id, customer_id, original_cents, remaining_cents, expires_at)
SELECT tenant_id, customer_id, balance_cents, balance_cents, NULL
FROM cashback_accounts WHERE balance_cents > 0;

CREATE TRIGGER cashback_accounts_tenant_guard_insert BEFORE INSERT ON cashback_accounts BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT, 'cashback account tenant mismatch') END;
END;
CREATE TRIGGER cashback_accounts_tenant_guard_update BEFORE UPDATE OF tenant_id,customer_id ON cashback_accounts BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT, 'cashback account tenant mismatch') END;
END;
CREATE TRIGGER cashback_credit_lots_tenant_guard_insert BEFORE INSERT ON cashback_credit_lots BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT, 'cashback lot customer tenant mismatch') END;
  SELECT CASE WHEN NEW.credit_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cashback_transactions WHERE id=NEW.credit_transaction_id AND tenant_id=NEW.tenant_id AND customer_id=NEW.customer_id)
    THEN RAISE(ABORT, 'cashback lot transaction tenant mismatch') END;
END;
CREATE TRIGGER cashback_credit_lots_tenant_guard_update BEFORE UPDATE OF tenant_id,customer_id,credit_transaction_id ON cashback_credit_lots BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT, 'cashback lot customer tenant mismatch') END;
  SELECT CASE WHEN NEW.credit_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cashback_transactions WHERE id=NEW.credit_transaction_id AND tenant_id=NEW.tenant_id AND customer_id=NEW.customer_id) THEN RAISE(ABORT, 'cashback lot transaction tenant mismatch') END;
END;
CREATE TRIGGER cashback_allocations_tenant_guard_insert BEFORE INSERT ON cashback_debit_allocations BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cashback_transactions WHERE id=NEW.debit_transaction_id AND tenant_id=NEW.tenant_id AND type='debit')
    THEN RAISE(ABORT, 'cashback allocation debit tenant mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cashback_credit_lots WHERE id=NEW.credit_lot_id AND tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT, 'cashback allocation lot tenant mismatch') END;
END;
CREATE TRIGGER cashback_allocations_tenant_guard_update BEFORE UPDATE OF tenant_id,debit_transaction_id,credit_lot_id ON cashback_debit_allocations BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cashback_transactions WHERE id=NEW.debit_transaction_id AND tenant_id=NEW.tenant_id AND type='debit') THEN RAISE(ABORT, 'cashback allocation debit tenant mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cashback_credit_lots WHERE id=NEW.credit_lot_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT, 'cashback allocation lot tenant mismatch') END;
END;

INSERT OR IGNORE INTO schema_migrations(version, description) VALUES('0005', 'Integer idempotent cashback ledger');
COMMIT;
