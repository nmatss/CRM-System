import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(__dirname, "../../migrations/0006_normalized_email_audit_events.sql"),
  "utf8",
);
const tempDirectories: string[] = [];

function legacyDatabase() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys=ON");
  sqlite.exec(`
    CREATE TABLE tenants(id INTEGER PRIMARY KEY);
    CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL);
    CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,description TEXT NOT NULL);
  `);
  return sqlite;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("0006 normalized email and audit migration", () => {
  it("upgrades a legacy database and rejects normalized collisions structurally", () => {
    const sqlite = legacyDatabase();
    sqlite.exec("INSERT INTO users(id,email) VALUES('u1',' First@Example.com ')");
    sqlite.exec(migration);

    expect(() =>
      sqlite.prepare("INSERT INTO users(id,email) VALUES('u2','first@example.COM')").run(),
    ).toThrow(/UNIQUE/);
    expect(
      sqlite.prepare("SELECT version FROM schema_migrations WHERE version='0006'").get(),
    ).toEqual({ version: "0006" });
    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    sqlite.close();
  });

  it("preflight aborts without merging or partially creating audit objects", () => {
    const sqlite = legacyDatabase();
    sqlite.exec(
      "INSERT INTO users(id,email) VALUES('u1','same@example.com'),('u2',' SAME@example.com ')",
    );

    expect(() => sqlite.exec(migration)).toThrow(/UNIQUE constraint failed/);
    expect(sqlite.prepare("SELECT id,email FROM users ORDER BY id").all()).toEqual([
      { id: "u1", email: "same@example.com" },
      { id: "u2", email: " SAME@example.com " },
    ]);
    expect(
      sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name='audit_events'").get(),
    ).toBeUndefined();
    expect(
      sqlite
        .prepare("SELECT 1 FROM sqlite_master WHERE name='users_email_normalized_unique'")
        .get(),
    ).toBeUndefined();
    sqlite.close();
  });

  it("retains snapshot identifiers while rejecting audit updates and deletes", () => {
    const sqlite = legacyDatabase();
    sqlite.exec(
      "INSERT INTO tenants VALUES(1); INSERT INTO users VALUES('actor','actor@example.com')",
    );
    sqlite.exec(migration);
    sqlite
      .prepare(
        "INSERT INTO audit_events(tenant_id,actor_user_id,action,target_type,target_id,outcome,request_id) VALUES(1,'actor','entity.deleted','users','actor','success','req-1')",
      )
      .run();

    sqlite.prepare("DELETE FROM users WHERE id='actor'").run();
    sqlite.prepare("DELETE FROM tenants WHERE id=1").run();
    expect(
      sqlite
        .prepare("SELECT tenant_id AS tenantId,actor_user_id AS actorUserId FROM audit_events")
        .get(),
    ).toEqual({ tenantId: 1, actorUserId: "actor" });
    expect(() =>
      sqlite.prepare("UPDATE audit_events SET outcome='failure' WHERE id=1").run(),
    ).toThrow(/append-only/);
    expect(() => sqlite.prepare("DELETE FROM audit_events WHERE id=1").run()).toThrow(
      /append-only/,
    );
    sqlite.close();
  });

  it("creates the equivalent objects on a fresh application bootstrap", () => {
    const directory = mkdtempSync(join(tmpdir(), "zippcrm-bootstrap-"));
    tempDirectories.push(directory);
    const databasePath = join(directory, "app.db");
    const sessionPath = join(directory, "sessions.db");
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--eval", "import('./server/db.ts')"],
      {
        cwd: resolve(__dirname, "../.."),
        env: {
          ...process.env,
          NODE_ENV: "test",
          DATABASE_PATH: databasePath,
          SESSION_DATABASE_PATH: sessionPath,
        },
        encoding: "utf8",
      },
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);

    const sqlite = new Database(databasePath, { readonly: true });
    expect(
      sqlite
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type='index' AND name='users_email_normalized_unique'",
        )
        .get(),
    ).toBeTruthy();
    expect(
      sqlite
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='audit_events'")
        .get(),
    ).toBeTruthy();
    expect(
      sqlite.prepare("SELECT version FROM schema_migrations WHERE version='0006'").get(),
    ).toEqual({ version: "0006" });
    sqlite.close();
  });
});
