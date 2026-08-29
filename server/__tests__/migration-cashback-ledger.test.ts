import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("0005 cashback ledger migration", () => {
  it("backfills legacy balances into cents/accounts/lots and preserves integrity", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys=ON");
    sqlite.exec(`
      CREATE TABLE tenants(id INTEGER PRIMARY KEY);
      CREATE TABLE customers(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL REFERENCES tenants(id));
      CREATE TABLE cashback_rules(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL REFERENCES tenants(id));
      CREATE TABLE orders(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL REFERENCES tenants(id));
      CREATE TABLE cashback_transactions(id INTEGER PRIMARY KEY AUTOINCREMENT,tenant_id INTEGER NOT NULL REFERENCES tenants(id),customer_id INTEGER NOT NULL REFERENCES customers(id),rule_id INTEGER REFERENCES cashback_rules(id),order_id INTEGER REFERENCES orders(id),type TEXT NOT NULL,amount REAL NOT NULL,balance REAL NOT NULL,description TEXT NOT NULL,expires_at TEXT,created_at TEXT DEFAULT(datetime('now')));
      CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,description TEXT NOT NULL);
      INSERT INTO tenants VALUES(1),(2); INSERT INTO customers VALUES(10,1),(20,2);
      INSERT INTO cashback_transactions(tenant_id,customer_id,type,amount,balance,description) VALUES(1,10,'credit',12.345,12.345,'legacy');
    `);
    sqlite.exec(
      readFileSync(resolve(__dirname, "../../migrations/0005_cashback_ledger.sql"), "utf8"),
    );
    expect(
      sqlite
        .prepare(
          "SELECT amount_cents AS amountCents,balance_cents AS balanceCents FROM cashback_transactions",
        )
        .get(),
    ).toEqual({ amountCents: 1235, balanceCents: 1235 });
    expect(
      sqlite.prepare("SELECT balance_cents AS balanceCents FROM cashback_accounts").get(),
    ).toEqual({ balanceCents: 1235 });
    expect(
      sqlite.prepare("SELECT remaining_cents AS remainingCents FROM cashback_credit_lots").get(),
    ).toEqual({ remainingCents: 1235 });
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO cashback_accounts(tenant_id,customer_id,balance_cents) VALUES(1,20,0)",
        )
        .run(),
    ).toThrow(/tenant mismatch/);
    expect(() =>
      sqlite
        .prepare("UPDATE cashback_accounts SET customer_id=20 WHERE tenant_id=1 AND customer_id=10")
        .run(),
    ).toThrow(/tenant mismatch/);
    expect(() =>
      sqlite.prepare("UPDATE cashback_transactions SET customer_id=20 WHERE id=1").run(),
    ).toThrow(/tenant mismatch/);
    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    sqlite.close();
  });
});
