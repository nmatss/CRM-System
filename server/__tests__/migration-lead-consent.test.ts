import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  resolve(__dirname, "../../migrations/0009_lead_consent.sql"),
  "utf8",
);

function createLegacyDatabase() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE contact_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE demo_requests (
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
    CREATE TABLE schema_migrations (
      version TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO contact_requests(name, email, message) VALUES ('Legado', 'legado@example.test', 'oi');
    INSERT INTO demo_requests(name, email, company) VALUES ('Legado', 'legado@example.test', 'Loja');
  `);
  return sqlite;
}

describe("0009 lead consent migration", () => {
  it("adds the consent columns without touching existing rows", () => {
    const sqlite = createLegacyDatabase();
    sqlite.exec(MIGRATION);

    const contact = sqlite
      .prepare(
        "SELECT name, consent_accepted_at AS acceptedAt, consent_policy_version AS policyVersion FROM contact_requests WHERE id = 1",
      )
      .get() as { name: string; acceptedAt: string | null; policyVersion: string | null };

    expect(contact.name).toBe("Legado");
    // NULL is the truthful value: consent genuinely was not captured for a row
    // created before the column existed, and the app must not claim otherwise.
    expect(contact.acceptedAt).toBeNull();
    expect(contact.policyVersion).toBeNull();

    const demo = sqlite
      .prepare("SELECT consent_accepted_at AS acceptedAt FROM demo_requests WHERE id = 1")
      .get() as { acceptedAt: string | null };
    expect(demo.acceptedAt).toBeNull();

    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(
      sqlite.prepare("SELECT version FROM schema_migrations WHERE version = '0009'").get(),
    ).toEqual({ version: "0009" });

    sqlite.close();
  });

  it("records consent for a new row", () => {
    const sqlite = createLegacyDatabase();
    sqlite.exec(MIGRATION);

    sqlite
      .prepare(
        `INSERT INTO contact_requests(name, email, message, consent_accepted_at, consent_policy_version)
         VALUES ('Nova', 'nova@example.test', 'mensagem', '2026-08-29T12:00:00.000Z', '2026-08-29')`,
      )
      .run();

    const row = sqlite
      .prepare(
        "SELECT consent_accepted_at AS acceptedAt, consent_policy_version AS policyVersion FROM contact_requests WHERE name = 'Nova'",
      )
      .get() as { acceptedAt: string; policyVersion: string };

    expect(row.acceptedAt).toBe("2026-08-29T12:00:00.000Z");
    expect(row.policyVersion).toBe("2026-08-29");

    sqlite.close();
  });
});
