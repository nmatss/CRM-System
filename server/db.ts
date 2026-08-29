import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";
import { existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";

// Database file path - stored in data directory
const DB_PATH = process.env.DATABASE_PATH || "./data/zippcrm.db";
const SESSION_DB_PATH = process.env.SESSION_DATABASE_PATH || DB_PATH;
const usesSeparateSessionDatabase = resolve(SESSION_DB_PATH) !== resolve(DB_PATH);
const dbExistedBeforeOpen = existsSync(DB_PATH);
const CURRENT_SCHEMA_VERSION = "2026-08-29-integer-money-reports-1";

// Ensure data directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Create SQLite database connection
const sqlite = new Database(DB_PATH);

// Enable foreign keys and WAL mode for better performance
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");

function hasApplicationSchema() {
  const requiredTables = ["tenants", "users", "tenant_users", "customers", "products", "orders"];
  return requiredTables.every((table) =>
    Boolean(
      sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
    ),
  );
}

function assertProductionBootstrapAllowed() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (hasApplicationSchema()) {
    return;
  }

  if (process.env.ALLOW_EMPTY_DATABASE_BOOTSTRAP === "true") {
    return;
  }

  throw new Error(
    `SQLite database at ${DB_PATH} ${dbExistedBeforeOpen ? "has no application schema" : "did not exist before startup"}. ` +
      "Refusing to bootstrap an empty production database without ALLOW_EMPTY_DATABASE_BOOTSTRAP=true.",
  );
}

function validateSqliteIntegrity() {
  const integrity = sqlite.prepare("PRAGMA integrity_check").get() as { integrity_check?: string };
  if (integrity.integrity_check !== "ok") {
    throw new Error(`SQLite integrity_check failed: ${integrity.integrity_check || "unknown"}`);
  }

  const foreignKeyIssues = sqlite.prepare("PRAGMA foreign_key_check").all();
  if (foreignKeyIssues.length > 0) {
    throw new Error(`SQLite foreign_key_check failed with ${foreignKeyIssues.length} issue(s)`);
  }
}

function getTableColumns(tableName: string): Set<string> {
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

function assertSqliteObjectExists(type: "table" | "index" | "trigger", name: string) {
  const row = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?")
    .get(type, name);

  if (!row) {
    throw new Error(`SQLite schema validation failed: missing ${type} ${name}`);
  }
}

function validateRequiredSchemaObjects() {
  const requiredTables = [
    "tenants",
    "users",
    "tenant_users",
    "customers",
    "products",
    "orders",
    "order_items",
    "cashback_transactions",
    "cashback_accounts",
    "cashback_credit_lots",
    "cashback_debit_allocations",
    "audit_events",
    "schema_migrations",
  ];

  for (const table of requiredTables) {
    assertSqliteObjectExists("table", table);
  }

  const requiredColumns: Record<string, string[]> = {
    users: ["id", "email", "password", "name", "must_change_password", "last_password_change"],
    customers: ["id", "tenant_id", "email", "segment", "ltv", "ltv_cents"],
    products: ["id", "tenant_id", "price", "price_cents", "stock", "status"],
    orders: ["id", "tenant_id", "order_id", "customer_id", "order_date", "total", "total_cents"],
    order_items: [
      "id",
      "tenant_id",
      "order_id",
      "product_id",
      "category_snapshot",
      "quantity",
      "unit_price_cents",
      "line_total_cents",
    ],
    cashback_transactions: [
      "id",
      "tenant_id",
      "customer_id",
      "amount_cents",
      "balance_cents",
      "idempotency_key",
      "source",
      "reversal_of_id",
    ],
    cashback_accounts: ["id", "tenant_id", "customer_id", "balance_cents"],
    cashback_credit_lots: [
      "id",
      "tenant_id",
      "customer_id",
      "original_cents",
      "remaining_cents",
      "expires_at",
    ],
    cashback_debit_allocations: [
      "id",
      "tenant_id",
      "debit_transaction_id",
      "credit_lot_id",
      "amount_cents",
    ],
    audit_events: [
      "id",
      "tenant_id",
      "actor_user_id",
      "action",
      "target_type",
      "target_id",
      "outcome",
      "request_id",
      "metadata_json",
      "created_at",
    ],
  };

  for (const [table, columns] of Object.entries(requiredColumns)) {
    const existingColumns = getTableColumns(table);
    for (const column of columns) {
      if (!existingColumns.has(column)) {
        throw new Error(`SQLite schema validation failed: missing column ${table}.${column}`);
      }
    }
  }

  const requiredIndexes = [
    "orders_tenant_order_id_unique",
    "orders_tenant_customer_order_date_idx",
    "order_items_tenant_order_product_unique",
    "order_items_order_id_idx",
    "order_items_product_id_idx",
    "cashback_transactions_tenant_customer_created_idx",
    "cashback_transactions_tenant_expires_idx",
    "cashback_transactions_tenant_idempotency_unique",
    "cashback_accounts_tenant_customer_unique",
    "cashback_credit_lots_tenant_customer_expiry_idx",
    "tenant_users_tenant_user_unique",
    "users_email_normalized_unique",
    "audit_events_tenant_created_idx",
    "audit_events_actor_created_idx",
    "audit_events_action_created_idx",
    "audit_events_request_id_idx",
    "order_items_tenant_category_idx",
  ];

  for (const index of requiredIndexes) {
    assertSqliteObjectExists("index", index);
  }

  assertSqliteObjectExists("trigger", "order_items_tenant_guard_insert");
  assertSqliteObjectExists("trigger", "order_items_tenant_guard_update");
  assertSqliteObjectExists("trigger", "cashback_accounts_tenant_guard_insert");
  assertSqliteObjectExists("trigger", "cashback_accounts_tenant_guard_update");
  assertSqliteObjectExists("trigger", "cashback_transactions_tenant_guard_insert");
  assertSqliteObjectExists("trigger", "cashback_transactions_tenant_guard_update");
  assertSqliteObjectExists("trigger", "cashback_credit_lots_tenant_guard_insert");
  assertSqliteObjectExists("trigger", "cashback_credit_lots_tenant_guard_update");
  assertSqliteObjectExists("trigger", "cashback_allocations_tenant_guard_insert");
  assertSqliteObjectExists("trigger", "cashback_allocations_tenant_guard_update");
  assertSqliteObjectExists("trigger", "audit_events_append_only_update");
  assertSqliteObjectExists("trigger", "audit_events_append_only_delete");
  assertSqliteObjectExists("trigger", "products_price_cents_legacy_insert");
  assertSqliteObjectExists("trigger", "products_price_cents_legacy_update");
  assertSqliteObjectExists("trigger", "customers_ltv_cents_legacy_insert");
  assertSqliteObjectExists("trigger", "customers_ltv_cents_legacy_update");
  assertSqliteObjectExists("trigger", "order_items_category_snapshot_immutable");
}

function recordSchemaVersion() {
  sqlite
    .prepare(
      `
    INSERT OR IGNORE INTO schema_migrations (version, description)
    VALUES (?, ?)
  `,
    )
    .run(
      CURRENT_SCHEMA_VERSION,
      "SQLite bootstrap through integer catalog money and historical report snapshots",
    );
}

function initializeSqliteSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      logo TEXT,
      primary_color TEXT DEFAULT '#9333ea',
      secondary_color TEXT DEFAULT '#db2777',
      login_message TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      cpf TEXT UNIQUE,
      seller_code TEXT,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      is_super_admin INTEGER NOT NULL DEFAULT 0,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      last_password_change TEXT,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tenant_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'seller',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_by_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      segment TEXT NOT NULL,
      ltv REAL NOT NULL DEFAULT 0 CHECK (ltv >= 0),
      ltv_cents INTEGER NOT NULL DEFAULT 0 CHECK (ltv_cents >= 0),
      last_purchase TEXT,
      favorite_category TEXT,
      image TEXT,
      birth_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
      price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      status TEXT NOT NULL DEFAULT 'active',
      image TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_id TEXT NOT NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer TEXT NOT NULL,
      order_date TEXT DEFAULT (datetime('now')),
      total REAL NOT NULL DEFAULT 0 CHECK (total >= 0),
      total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
      status TEXT NOT NULL DEFAULT 'Pendente',
      items INTEGER NOT NULL DEFAULT 0,
      method TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (tenant_id, order_id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      category_snapshot TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
      line_total_cents INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      CONSTRAINT order_items_line_total_cents_check
        CHECK (line_total_cents = unit_price_cents * quantity)
    );

    CREATE TABLE IF NOT EXISTS cashback_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      trigger TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      validity INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'active',
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cashback_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      rule_id INTEGER REFERENCES cashback_rules(id) ON DELETE SET NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
      amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
      balance REAL NOT NULL DEFAULT 0 CHECK (balance >= 0),
      description TEXT NOT NULL,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      channel TEXT NOT NULL,
      audience TEXT NOT NULL,
      message TEXT,
      sent INTEGER NOT NULL DEFAULT 0,
      open_rate REAL NOT NULL DEFAULT 0 CHECK (open_rate >= 0 AND open_rate <= 100),
      conversion REAL NOT NULL DEFAULT 0 CHECK (conversion >= 0 AND conversion <= 100),
      revenue REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      stats TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contact_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS demo_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      company TEXT NOT NULL,
      store_count TEXT,
      preferred_date TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS seller_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      seller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      due_date TEXT NOT NULL,
      script TEXT,
      notes TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS seller_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      seller_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      daily_task_goal INTEGER NOT NULL DEFAULT 10,
      weekly_task_goal INTEGER NOT NULL DEFAULT 50,
      monthly_task_goal INTEGER NOT NULL DEFAULT 200,
      daily_sales_goal REAL NOT NULL DEFAULT 0,
      weekly_sales_goal REAL NOT NULL DEFAULT 0,
      monthly_sales_goal REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (tenant_id, seller_id)
    );

    CREATE TABLE IF NOT EXISTS customer_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      seller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      task_id INTEGER REFERENCES seller_tasks(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      channel TEXT NOT NULL,
      notes TEXT,
      outcome TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      channel TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS tenants_status_idx ON tenants(status);
    CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
    CREATE INDEX IF NOT EXISTS users_status_idx ON users(status);
    CREATE INDEX IF NOT EXISTS users_seller_code_idx ON users(seller_code);
    CREATE INDEX IF NOT EXISTS tenant_users_tenant_id_idx ON tenant_users(tenant_id);
    CREATE INDEX IF NOT EXISTS tenant_users_user_id_idx ON tenant_users(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_tenant_user_unique ON tenant_users(tenant_id, user_id);
    CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets(user_id);
    CREATE INDEX IF NOT EXISTS password_resets_expires_at_idx ON password_resets(expires_at);
    CREATE INDEX IF NOT EXISTS customers_tenant_id_idx ON customers(tenant_id);
    CREATE INDEX IF NOT EXISTS customers_email_idx ON customers(email);
    CREATE INDEX IF NOT EXISTS customers_segment_idx ON customers(segment);
    CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers(created_at);
    CREATE INDEX IF NOT EXISTS customers_tenant_segment_idx ON customers(tenant_id, segment);
    CREATE INDEX IF NOT EXISTS products_tenant_id_idx ON products(tenant_id);
    CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
    CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
    CREATE INDEX IF NOT EXISTS products_tenant_category_idx ON products(tenant_id, category);
    CREATE INDEX IF NOT EXISTS orders_tenant_id_idx ON orders(tenant_id);
    CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
    CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
    CREATE INDEX IF NOT EXISTS orders_order_date_idx ON orders(order_date);
    CREATE INDEX IF NOT EXISTS orders_tenant_status_idx ON orders(tenant_id, status);
    CREATE INDEX IF NOT EXISTS orders_tenant_customer_order_date_idx ON orders(tenant_id, customer_id, order_date);
    CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_order_id_unique ON orders(tenant_id, order_id);
    CREATE INDEX IF NOT EXISTS order_items_tenant_id_idx ON order_items(tenant_id);
    CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items(product_id);
    CREATE INDEX IF NOT EXISTS order_items_tenant_category_idx ON order_items(tenant_id, category_snapshot);
    CREATE UNIQUE INDEX IF NOT EXISTS order_items_tenant_order_product_unique ON order_items(tenant_id, order_id, product_id);
    CREATE INDEX IF NOT EXISTS cashback_rules_tenant_id_idx ON cashback_rules(tenant_id);
    CREATE INDEX IF NOT EXISTS cashback_rules_status_idx ON cashback_rules(status);
    CREATE INDEX IF NOT EXISTS cashback_transactions_tenant_id_idx ON cashback_transactions(tenant_id);
    CREATE INDEX IF NOT EXISTS cashback_transactions_customer_id_idx ON cashback_transactions(customer_id);
    CREATE INDEX IF NOT EXISTS cashback_transactions_created_at_idx ON cashback_transactions(created_at);
    CREATE INDEX IF NOT EXISTS cashback_transactions_expires_at_idx ON cashback_transactions(expires_at);
    CREATE INDEX IF NOT EXISTS cashback_transactions_tenant_customer_created_idx ON cashback_transactions(tenant_id, customer_id, created_at);
    CREATE INDEX IF NOT EXISTS cashback_transactions_tenant_expires_idx ON cashback_transactions(tenant_id, expires_at);
    CREATE INDEX IF NOT EXISTS campaigns_tenant_id_idx ON campaigns(tenant_id);
    CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns(status);
    CREATE INDEX IF NOT EXISTS campaigns_created_at_idx ON campaigns(created_at);
    CREATE INDEX IF NOT EXISTS campaigns_channel_idx ON campaigns(channel);
    CREATE INDEX IF NOT EXISTS automations_tenant_id_idx ON automations(tenant_id);
    CREATE INDEX IF NOT EXISTS automations_is_active_idx ON automations(is_active);
    CREATE INDEX IF NOT EXISTS contact_requests_status_idx ON contact_requests(status);
    CREATE INDEX IF NOT EXISTS contact_requests_created_at_idx ON contact_requests(created_at);
    CREATE INDEX IF NOT EXISTS demo_requests_status_idx ON demo_requests(status);
    CREATE INDEX IF NOT EXISTS demo_requests_created_at_idx ON demo_requests(created_at);
    CREATE INDEX IF NOT EXISTS seller_tasks_tenant_id_idx ON seller_tasks(tenant_id);
    CREATE INDEX IF NOT EXISTS seller_tasks_seller_id_idx ON seller_tasks(seller_id);
    CREATE INDEX IF NOT EXISTS seller_tasks_customer_id_idx ON seller_tasks(customer_id);
    CREATE INDEX IF NOT EXISTS seller_tasks_status_idx ON seller_tasks(status);
    CREATE INDEX IF NOT EXISTS seller_tasks_completed_at_idx ON seller_tasks(completed_at);
    CREATE INDEX IF NOT EXISTS seller_tasks_type_idx ON seller_tasks(type);
    CREATE INDEX IF NOT EXISTS seller_tasks_due_date_idx ON seller_tasks(due_date);
    CREATE INDEX IF NOT EXISTS seller_tasks_tenant_seller_idx ON seller_tasks(tenant_id, seller_id);
    CREATE INDEX IF NOT EXISTS seller_tasks_tenant_status_idx ON seller_tasks(tenant_id, status);
    CREATE INDEX IF NOT EXISTS seller_goals_tenant_id_idx ON seller_goals(tenant_id);
    CREATE INDEX IF NOT EXISTS seller_goals_seller_id_idx ON seller_goals(seller_id);
    CREATE UNIQUE INDEX IF NOT EXISTS seller_goals_tenant_seller_unique ON seller_goals(tenant_id, seller_id);
    CREATE INDEX IF NOT EXISTS customer_interactions_tenant_id_idx ON customer_interactions(tenant_id);
    CREATE INDEX IF NOT EXISTS customer_interactions_customer_id_idx ON customer_interactions(customer_id);
    CREATE INDEX IF NOT EXISTS customer_interactions_seller_id_idx ON customer_interactions(seller_id);
    CREATE INDEX IF NOT EXISTS customer_interactions_task_id_idx ON customer_interactions(task_id);
    CREATE INDEX IF NOT EXISTS customer_interactions_channel_idx ON customer_interactions(channel);
    CREATE INDEX IF NOT EXISTS customer_interactions_type_idx ON customer_interactions(type);
    CREATE INDEX IF NOT EXISTS customer_interactions_created_at_idx ON customer_interactions(created_at);
    CREATE INDEX IF NOT EXISTS notifications_tenant_id_idx ON notifications(tenant_id);
    CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications(status);
    CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);
    CREATE INDEX IF NOT EXISTS notifications_tenant_user_idx ON notifications(tenant_id, user_id);
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS order_items_tenant_guard_insert
    BEFORE INSERT ON order_items
    BEGIN
      SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM orders WHERE id = NEW.order_id AND tenant_id = NEW.tenant_id
      ) THEN RAISE(ABORT, 'order_items order tenant mismatch') END;
      SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM products WHERE id = NEW.product_id AND tenant_id = NEW.tenant_id
      ) THEN RAISE(ABORT, 'order_items product tenant mismatch') END;
    END;

    CREATE TRIGGER IF NOT EXISTS order_items_tenant_guard_update
    BEFORE UPDATE OF tenant_id, order_id, product_id ON order_items
    BEGIN
      SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM orders WHERE id = NEW.order_id AND tenant_id = NEW.tenant_id
      ) THEN RAISE(ABORT, 'order_items order tenant mismatch') END;
      SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM products WHERE id = NEW.product_id AND tenant_id = NEW.tenant_id
      ) THEN RAISE(ABORT, 'order_items product tenant mismatch') END;
    END;
  `);

  if (!usesSeparateSessionDatabase) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess JSON NOT NULL,
        expire TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions(expire);
    `);
  }
}

function applyOrderItemsAdditiveMigration() {
  const orderColumns = getTableColumns("orders");
  if (!orderColumns.has("total_cents")) {
    sqlite.exec(
      "ALTER TABLE orders ADD COLUMN total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0)",
    );
    sqlite.exec("UPDATE orders SET total_cents = CAST(ROUND(total * 100) AS INTEGER)");
  }

  sqlite
    .prepare(
      `
    INSERT OR IGNORE INTO schema_migrations (version, description)
    VALUES ('0004', 'Transactional order items and integer monetary snapshots')
  `,
    )
    .run();
}

function applyCashbackLedgerAdditiveMigration() {
  const columns = getTableColumns("cashback_transactions");
  const additions: Array<[string, string]> = [
    ["amount_cents", "INTEGER NOT NULL DEFAULT 0 CHECK(amount_cents >= 0)"],
    ["balance_cents", "INTEGER NOT NULL DEFAULT 0 CHECK(balance_cents >= 0)"],
    ["idempotency_key", "TEXT"],
    ["request_hash", "TEXT"],
    ["source", "TEXT NOT NULL DEFAULT 'legacy'"],
    ["reversal_of_id", "INTEGER REFERENCES cashback_transactions(id)"],
  ];
  const needsBackfill = !columns.has("amount_cents") || !columns.has("balance_cents");
  for (const [name, definition] of additions) {
    if (!columns.has(name))
      sqlite.exec(`ALTER TABLE cashback_transactions ADD COLUMN ${name} ${definition}`);
  }
  if (needsBackfill) {
    sqlite.exec(
      "UPDATE cashback_transactions SET amount_cents=CAST(ROUND(amount*100) AS INTEGER), balance_cents=CAST(ROUND(balance*100) AS INTEGER)",
    );
  }

  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS cashback_transactions_tenant_idempotency_unique ON cashback_transactions(tenant_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS cashback_transactions_tenant_reversal_unique ON cashback_transactions(tenant_id,reversal_of_id) WHERE reversal_of_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS cashback_accounts(id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE, balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(balance_cents>=0), updated_at TEXT DEFAULT(datetime('now')), UNIQUE(tenant_id,customer_id));
    CREATE TABLE IF NOT EXISTS cashback_credit_lots(id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE, credit_transaction_id INTEGER REFERENCES cashback_transactions(id) ON DELETE RESTRICT, original_cents INTEGER NOT NULL CHECK(original_cents>0), remaining_cents INTEGER NOT NULL CHECK(remaining_cents>=0 AND remaining_cents<=original_cents), expires_at TEXT, created_at TEXT DEFAULT(datetime('now')));
    CREATE TABLE IF NOT EXISTS cashback_debit_allocations(id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, debit_transaction_id INTEGER NOT NULL REFERENCES cashback_transactions(id) ON DELETE CASCADE, credit_lot_id INTEGER NOT NULL REFERENCES cashback_credit_lots(id) ON DELETE RESTRICT, amount_cents INTEGER NOT NULL CHECK(amount_cents>0), UNIQUE(debit_transaction_id,credit_lot_id));
    CREATE UNIQUE INDEX IF NOT EXISTS cashback_accounts_tenant_customer_unique ON cashback_accounts(tenant_id,customer_id);
    CREATE INDEX IF NOT EXISTS cashback_credit_lots_tenant_customer_expiry_idx ON cashback_credit_lots(tenant_id,customer_id,expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS cashback_debit_allocations_transaction_lot_unique ON cashback_debit_allocations(debit_transaction_id,credit_lot_id);
    CREATE TRIGGER IF NOT EXISTS cashback_transactions_tenant_guard_insert BEFORE INSERT ON cashback_transactions BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback transaction customer tenant mismatch') END; SELECT CASE WHEN NEW.rule_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cashback_rules WHERE id=NEW.rule_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback transaction rule tenant mismatch') END; SELECT CASE WHEN NEW.order_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback transaction order tenant mismatch') END; END;
    CREATE TRIGGER IF NOT EXISTS cashback_transactions_tenant_guard_update BEFORE UPDATE OF tenant_id,customer_id,rule_id,order_id ON cashback_transactions BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback transaction customer tenant mismatch') END; SELECT CASE WHEN NEW.rule_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cashback_rules WHERE id=NEW.rule_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback transaction rule tenant mismatch') END; SELECT CASE WHEN NEW.order_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback transaction order tenant mismatch') END; END;
    CREATE TRIGGER IF NOT EXISTS cashback_accounts_tenant_guard_insert BEFORE INSERT ON cashback_accounts BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback account tenant mismatch') END; END;
    CREATE TRIGGER IF NOT EXISTS cashback_accounts_tenant_guard_update BEFORE UPDATE OF tenant_id,customer_id ON cashback_accounts BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback account tenant mismatch') END; END;
    CREATE TRIGGER IF NOT EXISTS cashback_credit_lots_tenant_guard_insert BEFORE INSERT ON cashback_credit_lots BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback lot customer tenant mismatch') END; SELECT CASE WHEN NEW.credit_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cashback_transactions WHERE id=NEW.credit_transaction_id AND tenant_id=NEW.tenant_id AND customer_id=NEW.customer_id) THEN RAISE(ABORT,'cashback lot transaction tenant mismatch') END; END;
    CREATE TRIGGER IF NOT EXISTS cashback_credit_lots_tenant_guard_update BEFORE UPDATE OF tenant_id,customer_id,credit_transaction_id ON cashback_credit_lots BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM customers WHERE id=NEW.customer_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback lot customer tenant mismatch') END; SELECT CASE WHEN NEW.credit_transaction_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM cashback_transactions WHERE id=NEW.credit_transaction_id AND tenant_id=NEW.tenant_id AND customer_id=NEW.customer_id) THEN RAISE(ABORT,'cashback lot transaction tenant mismatch') END; END;
    CREATE TRIGGER IF NOT EXISTS cashback_allocations_tenant_guard_insert BEFORE INSERT ON cashback_debit_allocations BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cashback_transactions WHERE id=NEW.debit_transaction_id AND tenant_id=NEW.tenant_id AND type='debit') THEN RAISE(ABORT,'cashback allocation debit tenant mismatch') END; SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cashback_credit_lots WHERE id=NEW.credit_lot_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback allocation lot tenant mismatch') END; END;
    CREATE TRIGGER IF NOT EXISTS cashback_allocations_tenant_guard_update BEFORE UPDATE OF tenant_id,debit_transaction_id,credit_lot_id ON cashback_debit_allocations BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cashback_transactions WHERE id=NEW.debit_transaction_id AND tenant_id=NEW.tenant_id AND type='debit') THEN RAISE(ABORT,'cashback allocation debit tenant mismatch') END; SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM cashback_credit_lots WHERE id=NEW.credit_lot_id AND tenant_id=NEW.tenant_id) THEN RAISE(ABORT,'cashback allocation lot tenant mismatch') END; END;
  `);

  if (needsBackfill) {
    sqlite.exec(`
      INSERT OR IGNORE INTO cashback_accounts(tenant_id,customer_id,balance_cents)
      SELECT t.tenant_id,t.customer_id,t.balance_cents FROM cashback_transactions t WHERE t.id=(SELECT MAX(t2.id) FROM cashback_transactions t2 WHERE t2.tenant_id=t.tenant_id AND t2.customer_id=t.customer_id);
      INSERT INTO cashback_credit_lots(tenant_id,customer_id,original_cents,remaining_cents) SELECT tenant_id,customer_id,balance_cents,balance_cents FROM cashback_accounts WHERE balance_cents>0 AND NOT EXISTS(SELECT 1 FROM cashback_credit_lots);
    `);
  }
  sqlite
    .prepare(
      "INSERT OR IGNORE INTO schema_migrations(version,description) VALUES('0005','Integer idempotent cashback ledger')",
    )
    .run();
}

function applyNormalizedEmailAndAuditMigration() {
  const collision = sqlite
    .prepare(
      `
    SELECT COUNT(*) AS count FROM (
      SELECT LOWER(TRIM(email))
      FROM users
      GROUP BY LOWER(TRIM(email))
      HAVING COUNT(*) > 1
    )
  `,
    )
    .get() as { count: number };

  if (collision.count > 0) {
    throw new Error(
      `Normalized email preflight failed: ${collision.count} duplicate group(s) must be resolved before migration 0006; no rows were changed`,
    );
  }

  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique
        ON users(LOWER(TRIM(email)));
      CREATE TABLE IF NOT EXISTS audit_events(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER,
        actor_user_id TEXT,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT,
        outcome TEXT NOT NULL CHECK(outcome IN ('success','failure')),
        request_id TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json)),
        created_at TEXT NOT NULL DEFAULT(datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx ON audit_events(tenant_id,created_at);
      CREATE INDEX IF NOT EXISTS audit_events_actor_created_idx ON audit_events(actor_user_id,created_at);
      CREATE INDEX IF NOT EXISTS audit_events_action_created_idx ON audit_events(action,created_at);
      CREATE INDEX IF NOT EXISTS audit_events_request_id_idx ON audit_events(request_id);
      CREATE TRIGGER IF NOT EXISTS audit_events_append_only_update BEFORE UPDATE ON audit_events BEGIN
        SELECT RAISE(ABORT,'audit events are append-only');
      END;
      CREATE TRIGGER IF NOT EXISTS audit_events_append_only_delete BEFORE DELETE ON audit_events BEGIN
        SELECT RAISE(ABORT,'audit events are append-only');
      END;
    `);
    sqlite
      .prepare(
        "INSERT OR IGNORE INTO schema_migrations(version,description) VALUES('0006','Normalized unique user email and immutable security audit events')",
      )
      .run();
  })();
}

function applyIntegerMoneyReportsMigration() {
  const productColumns = getTableColumns("products");
  const customerColumns = getTableColumns("customers");
  const itemColumns = getTableColumns("order_items");

  sqlite.transaction(() => {
    if (!productColumns.has("price_cents")) {
      sqlite.exec(
        "ALTER TABLE products ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0 CHECK(price_cents>=0)",
      );
      sqlite.exec("UPDATE products SET price_cents=CAST(ROUND(price*100) AS INTEGER)");
    }
    if (!customerColumns.has("ltv_cents")) {
      sqlite.exec(
        "ALTER TABLE customers ADD COLUMN ltv_cents INTEGER NOT NULL DEFAULT 0 CHECK(ltv_cents>=0)",
      );
      sqlite.exec("UPDATE customers SET ltv_cents=CAST(ROUND(ltv*100) AS INTEGER)");
    }
    if (!itemColumns.has("category_snapshot")) {
      sqlite.exec(
        "ALTER TABLE order_items ADD COLUMN category_snapshot TEXT NOT NULL DEFAULT 'Outros'",
      );
      sqlite.exec(`
        UPDATE order_items SET category_snapshot=COALESCE(
          (SELECT NULLIF(TRIM(products.category),'') FROM products WHERE products.id=order_items.product_id),
          'Outros'
        )
      `);
    }

    sqlite.exec(`
      CREATE TRIGGER IF NOT EXISTS products_price_cents_legacy_insert AFTER INSERT ON products
      WHEN NEW.price_cents != CAST(ROUND(NEW.price*100) AS INTEGER) BEGIN
        UPDATE products SET price_cents=CAST(ROUND(NEW.price*100) AS INTEGER) WHERE id=NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS products_price_cents_legacy_update AFTER UPDATE OF price ON products
      WHEN NEW.price_cents != CAST(ROUND(NEW.price*100) AS INTEGER) BEGIN
        UPDATE products SET price_cents=CAST(ROUND(NEW.price*100) AS INTEGER) WHERE id=NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS customers_ltv_cents_legacy_insert AFTER INSERT ON customers
      WHEN NEW.ltv_cents != CAST(ROUND(NEW.ltv*100) AS INTEGER) BEGIN
        UPDATE customers SET ltv_cents=CAST(ROUND(NEW.ltv*100) AS INTEGER) WHERE id=NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS customers_ltv_cents_legacy_update AFTER UPDATE OF ltv ON customers
      WHEN NEW.ltv_cents != CAST(ROUND(NEW.ltv*100) AS INTEGER) BEGIN
        UPDATE customers SET ltv_cents=CAST(ROUND(NEW.ltv*100) AS INTEGER) WHERE id=NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS order_items_category_snapshot_immutable BEFORE UPDATE OF category_snapshot ON order_items
      WHEN NEW.category_snapshot != OLD.category_snapshot BEGIN
        SELECT RAISE(ABORT,'order item category snapshot is immutable');
      END;
      CREATE INDEX IF NOT EXISTS order_items_tenant_category_idx ON order_items(tenant_id,category_snapshot);
    `);
    sqlite
      .prepare(
        "INSERT OR IGNORE INTO schema_migrations(version,description) VALUES('0007','Integer catalog money and historical report category snapshots')",
      )
      .run();
  })();

  const mismatch = sqlite
    .prepare(
      `
    SELECT
      (SELECT COUNT(*) FROM products WHERE price_cents != CAST(ROUND(price*100) AS INTEGER)) +
      (SELECT COUNT(*) FROM customers WHERE ltv_cents != CAST(ROUND(ltv*100) AS INTEGER)) +
      (SELECT COUNT(*) FROM order_items WHERE TRIM(category_snapshot)='') AS count
  `,
    )
    .get() as { count: number };
  if (mismatch.count > 0) {
    throw new Error(
      `Integer money/report snapshot reconciliation failed with ${mismatch.count} mismatch(es)`,
    );
  }
}

assertProductionBootstrapAllowed();
initializeSqliteSchema();
applyOrderItemsAdditiveMigration();
applyCashbackLedgerAdditiveMigration();
applyNormalizedEmailAndAuditMigration();
applyIntegerMoneyReportsMigration();
recordSchemaVersion();
validateRequiredSchemaObjects();
validateSqliteIntegrity();

export const db = drizzle(sqlite, { schema });

// Export raw sqlite connection for health checks
export { sqlite };
