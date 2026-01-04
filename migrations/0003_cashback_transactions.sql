-- Migration: Add Cashback Transactions Table
-- Description: Creates cashback_transactions table to track cashback credits and debits
-- Compatible with: SQLite
-- Generated: 2024-12-17

-- ==================== CASHBACK TRANSACTIONS TABLE ====================
-- Tracks cashback credits (earned) and debits (redeemed) for customers

CREATE TABLE IF NOT EXISTS cashback_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rule_id INTEGER REFERENCES cashback_rules(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
  amount REAL NOT NULL DEFAULT 0 CHECK(amount >= 0),
  balance REAL NOT NULL DEFAULT 0 CHECK(balance >= 0),
  description TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_tenant_id ON cashback_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_customer_id ON cashback_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_created_at ON cashback_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_cashback_transactions_expires_at ON cashback_transactions(expires_at);

-- Migration completed
-- Table: cashback_transactions created with CHECK constraints and indexes
