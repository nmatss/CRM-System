import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  resolve(__dirname, "../../migrations/0008_outbox_executions.sql"),
  "utf8",
);

/** A legacy database as it exists before migration 0008. */
function createLegacyDatabase() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE tenants (id INTEGER PRIMARY KEY);
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      segment TEXT NOT NULL
    );
    CREATE TABLE campaigns (
      id INTEGER PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      channel TEXT NOT NULL,
      audience TEXT NOT NULL,
      sent INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft'
    );
    CREATE TABLE automations (
      id INTEGER PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE schema_migrations (
      version TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO tenants(id) VALUES (1), (2);
    INSERT INTO users(id) VALUES ('user-1');
    INSERT INTO customers(id, tenant_id, name, email, segment)
      VALUES (10, 1, 'Legado A', 'a@example.com', 'VIP'),
             (20, 2, 'Legado B', 'b@example.com', 'VIP');
    INSERT INTO campaigns(id, tenant_id, name, channel, audience)
      VALUES (100, 1, 'Legado', 'email', 'Clientes VIP');
    INSERT INTO automations(id, tenant_id, title, description, icon)
      VALUES (200, 1, 'Legada', 'Definição legada', 'Zap');
  `);
  return sqlite;
}

describe("0008 outbox and executions migration", () => {
  it("upgrades a legacy database additively and preserves existing rows", () => {
    const sqlite = createLegacyDatabase();
    sqlite.exec(MIGRATION);

    // Existing data survives with safe defaults.
    expect(
      sqlite.prepare("SELECT marketing_opt_out AS optOut FROM customers WHERE id = 10").get(),
    ).toEqual({ optOut: 0 });
    expect(
      sqlite
        .prepare(
          "SELECT version, trigger_type AS triggerType, action_type AS actionType, action_channel AS actionChannel FROM automations WHERE id = 200",
        )
        .get(),
    ).toEqual({
      version: 1,
      triggerType: "customer.created",
      actionType: "notify_customer",
      actionChannel: "email",
    });

    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(
      sqlite.prepare("SELECT version FROM schema_migrations WHERE version = '0008'").get(),
    ).toEqual({ version: "0008" });
    sqlite.close();
  });

  it("enforces idempotency and cross-tenant guards structurally", () => {
    const sqlite = createLegacyDatabase();
    sqlite.exec(MIGRATION);

    const insertJob = sqlite.prepare(
      "INSERT INTO outbox_jobs(tenant_id, type, payload_json, idempotency_key, request_hash) VALUES (?, ?, '{}', ?, 'hash')",
    );
    insertJob.run(1, "campaign.dispatch", "key-1");
    // The same key cannot exist twice for one tenant...
    expect(() => insertJob.run(1, "campaign.dispatch", "key-1")).toThrow(/UNIQUE/i);
    // ...but tenants do not share the key space.
    expect(() => insertJob.run(2, "campaign.dispatch", "key-1")).not.toThrow();

    sqlite
      .prepare(
        "INSERT INTO campaign_executions(id, tenant_id, campaign_id, idempotency_key, channel, audience) VALUES (1, 1, 100, 'exec-1', 'email', 'Clientes VIP')",
      )
      .run();

    // An execution cannot point at a campaign of another tenant.
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO campaign_executions(tenant_id, campaign_id, idempotency_key, channel, audience) VALUES (2, 100, 'exec-2', 'email', 'Clientes VIP')",
        )
        .run(),
    ).toThrow(/tenant mismatch/);

    // A recipient cannot be a customer of another tenant.
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO campaign_recipients(tenant_id, execution_id, campaign_id, customer_id, channel) VALUES (1, 1, 100, 20, 'email')",
        )
        .run(),
    ).toThrow(/tenant mismatch/);

    // An automation execution cannot reference another tenant's automation.
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO automation_executions(tenant_id, automation_id, trigger_type, idempotency_key) VALUES (2, 200, 'customer.created', 'auto-1')",
        )
        .run(),
    ).toThrow(/tenant mismatch/);

    // Invalid states are rejected by the schema, not only by the application.
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO outbox_jobs(tenant_id, type, payload_json, idempotency_key, request_hash, status) VALUES (1, 'x', '{}', 'bad-status', 'hash', 'exploded')",
        )
        .run(),
    ).toThrow(/CHECK/i);
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO outbox_jobs(tenant_id, type, payload_json, idempotency_key, request_hash) VALUES (1, 'x', 'not json', 'bad-json', 'hash')",
        )
        .run(),
    ).toThrow(/CHECK/i);

    sqlite.close();
  });

  it("supports the documented containment path without rewriting legacy tables", () => {
    const sqlite = createLegacyDatabase();
    sqlite.exec(MIGRATION);

    // Containment drops only the new objects, in reverse dependency order.
    sqlite.exec(`
      DROP TABLE automation_executions;
      DROP TABLE campaign_recipients;
      DROP TABLE campaign_executions;
      DROP TABLE outbox_jobs;
      DELETE FROM schema_migrations WHERE version = '0008';
    `);

    // The previous binary still reads every legacy row.
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM customers").get()).toEqual({ total: 2 });
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM campaigns").get()).toEqual({ total: 1 });
    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    sqlite.close();
  });
});
