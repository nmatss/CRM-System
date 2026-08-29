import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("0004 order items migration", () => {
  it("upgrades a legacy database, backfills cents, and enforces tenant/FK integrity", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(`
      CREATE TABLE tenants (id INTEGER PRIMARY KEY);
      CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        price REAL NOT NULL,
        stock INTEGER NOT NULL
      );
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        order_id TEXT NOT NULL,
        customer TEXT NOT NULL,
        total REAL NOT NULL,
        items INTEGER NOT NULL,
        method TEXT NOT NULL
      );
      CREATE TABLE schema_migrations (
        version TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO tenants(id) VALUES (1), (2);
      INSERT INTO products(id, tenant_id, price, stock) VALUES (10, 1, 12.345, 5), (20, 2, 9, 5);
      INSERT INTO orders(id, tenant_id, order_id, customer, total, items, method)
        VALUES (100, 1, 'LEGACY-1', 'Legacy', 12.345, 1, 'PIX');
    `);

    const migration = readFileSync(
      resolve(__dirname, "../../migrations/0004_order_items.sql"),
      "utf8",
    );
    sqlite.exec(migration);

    expect(
      sqlite.prepare("SELECT total_cents AS totalCents FROM orders WHERE id = 100").get(),
    ).toEqual({ totalCents: 1235 });
    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(() =>
      sqlite
        .prepare(
          `
      INSERT INTO order_items(tenant_id, order_id, product_id, quantity, unit_price_cents, line_total_cents)
      VALUES (1, 100, 20, 1, 900, 900)
    `,
        )
        .run(),
    ).toThrow(/tenant mismatch/);
    expect(() =>
      sqlite
        .prepare(
          `
      INSERT INTO order_items(tenant_id, order_id, product_id, quantity, unit_price_cents, line_total_cents)
      VALUES (1, 100, 10, 0, 1235, 0)
    `,
        )
        .run(),
    ).toThrow();
    expect(
      sqlite.prepare("SELECT version FROM schema_migrations WHERE version = '0004'").get(),
    ).toEqual({ version: "0004" });
    sqlite.close();
  });
});
