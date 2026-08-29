import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(__dirname, "../../migrations/0007_integer_money_reports.sql"),
  "utf8",
);

function legacyDatabase(path = ":memory:") {
  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys=ON");
  sqlite.exec(`
    CREATE TABLE tenants(id INTEGER PRIMARY KEY);
    CREATE TABLE customers(
      id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,
      email TEXT NOT NULL,segment TEXT NOT NULL,ltv REAL NOT NULL DEFAULT 0 CHECK(ltv>=0)
    );
    CREATE TABLE products(
      id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,
      category TEXT NOT NULL,price REAL NOT NULL DEFAULT 0 CHECK(price>=0),stock INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE orders(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL REFERENCES tenants(id));
    CREATE TABLE order_items(
      id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      order_id INTEGER NOT NULL REFERENCES orders(id),product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,unit_price_cents INTEGER NOT NULL,line_total_cents INTEGER NOT NULL
    );
    CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,description TEXT NOT NULL);
    INSERT INTO tenants VALUES(1);
    INSERT INTO customers VALUES(1,1,'One Cent','one@example.com','Novo',0.01),(2,1,'Nineteen','nineteen@example.com','VIP',19.99);
    INSERT INTO products VALUES(1,1,'One Cent','Accessories',0.01,10),(2,1,'Nineteen','Apparel',19.99,10);
    INSERT INTO orders VALUES(1,1);
    INSERT INTO order_items VALUES(1,1,1,2,2,1999,3998);
  `);
  return sqlite;
}

describe("0007 integer money/report migration", () => {
  it("backfills deterministic cents and immutable historical categories", () => {
    const sqlite = legacyDatabase();
    sqlite.exec(migration);

    expect(
      sqlite.prepare("SELECT id,price_cents AS priceCents FROM products ORDER BY id").all(),
    ).toEqual([
      { id: 1, priceCents: 1 },
      { id: 2, priceCents: 1999 },
    ]);
    expect(
      sqlite.prepare("SELECT id,ltv_cents AS ltvCents FROM customers ORDER BY id").all(),
    ).toEqual([
      { id: 1, ltvCents: 1 },
      { id: 2, ltvCents: 1999 },
    ]);
    expect(sqlite.prepare("SELECT category_snapshot AS category FROM order_items").get()).toEqual({
      category: "Apparel",
    });
    expect(() =>
      sqlite.prepare("UPDATE order_items SET category_snapshot='Changed' WHERE id=1").run(),
    ).toThrow(/immutable/);
    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    sqlite.close();
  });

  it("keeps integer projections synchronized for legacy-only writes", () => {
    const sqlite = legacyDatabase();
    sqlite.exec(migration);
    sqlite.prepare("UPDATE products SET price=7.35 WHERE id=1").run();
    sqlite.prepare("UPDATE customers SET ltv=8.45 WHERE id=1").run();
    sqlite
      .prepare(
        "INSERT INTO products(id,tenant_id,name,category,price,stock) VALUES(3,1,'Legacy','Other',3.21,1)",
      )
      .run();

    expect(sqlite.prepare("SELECT price_cents AS cents FROM products WHERE id=1").get()).toEqual({
      cents: 735,
    });
    expect(sqlite.prepare("SELECT ltv_cents AS cents FROM customers WHERE id=1").get()).toEqual({
      cents: 845,
    });
    expect(sqlite.prepare("SELECT price_cents AS cents FROM products WHERE id=3").get()).toEqual({
      cents: 321,
    });
    expect(
      sqlite.prepare("SELECT version FROM schema_migrations WHERE version='0007'").get(),
    ).toEqual({ version: "0007" });
    sqlite.close();
  });

  it("upgrades a disposable database copy and supports explicit rollback after a partial failure", () => {
    const directory = mkdtempSync(join(tmpdir(), "crm-money-migration-"));
    const sourcePath = join(directory, "source.sqlite");
    const copyPath = join(directory, "upgrade-copy.sqlite");
    const source = legacyDatabase(sourcePath);
    source.close();
    copyFileSync(sourcePath, copyPath);

    const copy = new Database(copyPath);
    copy.pragma("foreign_keys=ON");
    copy.exec(migration);
    expect(copy.prepare("SELECT price_cents AS cents FROM products WHERE id=2").get()).toEqual({
      cents: 1999,
    });
    expect(copy.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(copy.pragma("foreign_key_check")).toEqual([]);
    copy.close();

    const rollback = legacyDatabase();
    rollback.exec(`
      CREATE TRIGGER order_items_category_snapshot_immutable
      BEFORE UPDATE ON orders BEGIN SELECT 1; END;
    `);
    expect(() => rollback.exec(migration)).toThrow(/already exists/);
    rollback.exec("ROLLBACK");
    const columns = rollback.prepare("PRAGMA table_info(products)").all() as Array<{
      name: string;
    }>;
    expect(columns.some((column) => column.name === "price_cents")).toBe(false);
    expect(
      rollback
        .prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE version='0007'")
        .get(),
    ).toEqual({ count: 0 });
    rollback.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
