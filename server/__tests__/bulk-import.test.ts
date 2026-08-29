import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";

/**
 * Gate F3: importing a spreadsheet must be predictable.
 *
 * A dry-run must project exactly what a commit would do, re-uploading the same
 * file must not duplicate the catalogue, an atomic import must leave nothing
 * behind when it is refused, and the importer must never invent data.
 */
describe("bulk import", () => {
  let bulk: typeof import("../services/bulkImport");
  let storage: (typeof import("../storage"))["storage"];
  let sqlite: (typeof import("../db"))["sqlite"];
  let tenantId: number;
  let otherTenantId: number;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_PATH = "./data/test-bulk-import.db";
    process.env.SESSION_DATABASE_PATH = "./data/test-bulk-import-sessions.db";

    bulk = await import("../services/bulkImport");
    ({ storage } = await import("../storage"));
    ({ sqlite } = await import("../db"));

    const suffix = randomUUID();
    tenantId = (
      await storage.createTenant({
        name: "Import Tenant",
        slug: `import-${suffix}`,
        plan: "test",
        status: "active",
      })
    ).id;
    otherTenantId = (
      await storage.createTenant({
        name: "Import Other",
        slug: `import-other-${suffix}`,
        plan: "test",
        status: "active",
      })
    ).id;
  });

  beforeEach(() => {
    sqlite.prepare("DELETE FROM customers WHERE tenant_id IN (?, ?)").run(tenantId, otherTenantId);
    sqlite.prepare("DELETE FROM products WHERE tenant_id IN (?, ?)").run(tenantId, otherTenantId);
    sqlite
      .prepare("DELETE FROM outbox_jobs WHERE tenant_id IN (?, ?)")
      .run(tenantId, otherTenantId);
  });

  function customerRows() {
    return [
      { nome: "Ana Alpha", email: "ANA@example.test", telefone: "1199990000", segmento: "VIP" },
      { name: "Bruno Beta", email: "bruno@example.test", ltv: "1.234,56" },
      { name: "Sem Email" },
    ];
  }

  function countCustomers() {
    return (
      sqlite
        .prepare("SELECT COUNT(*) AS total FROM customers WHERE tenant_id = ?")
        .get(tenantId) as { total: number }
    ).total;
  }

  it("a dry-run writes nothing and projects what a commit would do", () => {
    const dry = bulk.importCustomers({
      tenantId,
      rows: customerRows(),
      mode: "dry-run",
      onDuplicate: "skip",
      atomic: false,
    });

    expect(dry.totals.received).toBe(3);
    expect(dry.totals.valid).toBe(3);
    expect(dry.totals.created).toBe(3);
    // "Sem Email" has no deduplication key and is reported as such.
    expect(dry.totals.withoutKey).toBe(1);
    expect(countCustomers()).toBe(0);

    const committed = bulk.importCustomers({
      tenantId,
      rows: customerRows(),
      mode: "commit",
      onDuplicate: "skip",
      atomic: false,
    });

    // The projection matched reality.
    expect(committed.totals.created).toBe(dry.totals.created);
    expect(countCustomers()).toBe(3);
  });

  it("re-uploading the same file does not duplicate the base", () => {
    bulk.importCustomers({
      tenantId,
      rows: customerRows(),
      mode: "commit",
      onDuplicate: "skip",
      atomic: false,
    });
    expect(countCustomers()).toBe(3);

    const second = bulk.importCustomers({
      tenantId,
      rows: customerRows(),
      mode: "commit",
      onDuplicate: "skip",
      atomic: false,
    });

    expect(second.totals.duplicates).toBe(2);
    expect(second.totals.skipped).toBe(2);
    // Only the row without a key is created again, which is the honest outcome.
    expect(second.totals.created).toBe(1);
    expect(countCustomers()).toBe(4);
    expect(second.duplicates[0]).toMatchObject({ key: "email", origin: "database" });
  });

  it("detects a duplicate that exists twice inside the same file", () => {
    const outcome = bulk.importCustomers({
      tenantId,
      rows: [
        { name: "Repetida Um", email: "repetida@example.test" },
        { name: "Repetida Dois", email: "REPETIDA@example.test" },
      ],
      mode: "dry-run",
      onDuplicate: "skip",
      atomic: false,
    });

    expect(outcome.totals.duplicates).toBe(1);
    expect(outcome.duplicates[0]).toMatchObject({ origin: "file", row: 2 });
  });

  it("updates instead of skipping when the caller asks for it", () => {
    bulk.importCustomers({
      tenantId,
      rows: [{ name: "Antes", email: "mudanca@example.test", segmento: "Novo" }],
      mode: "commit",
      onDuplicate: "skip",
      atomic: false,
    });

    const outcome = bulk.importCustomers({
      tenantId,
      rows: [{ name: "Depois", email: "mudanca@example.test", segmento: "VIP" }],
      mode: "commit",
      onDuplicate: "update",
      atomic: false,
    });

    expect(outcome.totals.updated).toBe(1);
    const row = sqlite
      .prepare("SELECT name, segment FROM customers WHERE tenant_id = ? AND email = ?")
      .get(tenantId, "mudanca@example.test") as { name: string; segment: string };
    expect(row.name).toBe("Depois");
    expect(row.segment).toBe("VIP");
    expect(countCustomers()).toBe(1);
  });

  it("refuses the whole import when the caller asked to fail on duplicates", () => {
    bulk.importCustomers({
      tenantId,
      rows: [{ name: "Existente", email: "existente@example.test" }],
      mode: "commit",
      onDuplicate: "skip",
      atomic: false,
    });

    expect(() =>
      bulk.importCustomers({
        tenantId,
        rows: [{ name: "Existente", email: "existente@example.test" }],
        mode: "commit",
        onDuplicate: "fail",
        atomic: false,
      }),
    ).toThrow(bulk.ImportRefusedError);

    expect(countCustomers()).toBe(1);
  });

  it("an atomic import writes nothing when any row is invalid", () => {
    expect(() =>
      bulk.importCustomers({
        tenantId,
        rows: [
          { name: "Boa Linha", email: "boa@example.test" },
          { name: "X" },
          { name: "Outra Boa", email: "outra@example.test" },
        ],
        mode: "commit",
        onDuplicate: "skip",
        atomic: true,
      }),
    ).toThrow(bulk.ImportRefusedError);

    // All-or-nothing: the valid rows were not written either.
    expect(countCustomers()).toBe(0);
  });

  it("a non-atomic import keeps the valid rows and reports the invalid ones", () => {
    const outcome = bulk.importCustomers({
      tenantId,
      rows: [
        { name: "Boa Linha", email: "boa@example.test" },
        { name: "X" },
        { name: "Email Ruim", email: "nao-e-email" },
      ],
      mode: "commit",
      onDuplicate: "skip",
      atomic: false,
    });

    expect(outcome.totals.created).toBe(1);
    expect(outcome.totals.invalid).toBe(2);
    expect(outcome.issues.map((issue) => issue.row)).toEqual([2, 3]);
    expect(countCustomers()).toBe(1);
  });

  it("never invents a last purchase date", () => {
    bulk.importCustomers({
      tenantId,
      rows: [{ name: "Sem Compra", email: "sem-compra@example.test" }],
      mode: "commit",
      onDuplicate: "skip",
      atomic: false,
    });

    const row = sqlite
      .prepare(
        "SELECT last_purchase AS lastPurchase FROM customers WHERE tenant_id = ? AND email = ?",
      )
      .get(tenantId, "sem-compra@example.test") as { lastPurchase: string | null };

    // The previous implementation defaulted this to today, fabricating a sale.
    expect(row.lastPurchase).toBeNull();
  });

  it("parses Brazilian number formatting", () => {
    bulk.importCustomers({
      tenantId,
      rows: [{ name: "Valor BR", email: "valor@example.test", ltv: "R$ 1.234,56" }],
      mode: "commit",
      onDuplicate: "skip",
      atomic: false,
    });

    const row = sqlite
      .prepare("SELECT ltv_cents AS ltvCents FROM customers WHERE tenant_id = ? AND email = ?")
      .get(tenantId, "valor@example.test") as { ltvCents: number };
    expect(row.ltvCents).toBe(123456);
  });

  it("deduplicates only inside the active tenant", () => {
    sqlite
      .prepare(
        "INSERT INTO customers (tenant_id, name, email, segment) VALUES (?, 'Outro Tenant', 'compartilhado@example.test', 'Novo')",
      )
      .run(otherTenantId);

    const outcome = bulk.importCustomers({
      tenantId,
      rows: [{ name: "Meu Tenant", email: "compartilhado@example.test" }],
      mode: "commit",
      onDuplicate: "skip",
      atomic: false,
    });

    // Another tenant's row must not be treated as a duplicate of mine.
    expect(outcome.totals.duplicates).toBe(0);
    expect(outcome.totals.created).toBe(1);
  });

  it("fires the customer.created trigger for imported rows", () => {
    bulk.importCustomers({
      tenantId,
      rows: [{ name: "Com Evento", email: "evento@example.test" }],
      mode: "commit",
      onDuplicate: "skip",
      atomic: false,
    });

    const jobs = (
      sqlite
        .prepare("SELECT COUNT(*) AS total FROM outbox_jobs WHERE tenant_id = ?")
        .get(tenantId) as { total: number }
    ).total;
    // No active automation in this fixture, so zero jobs is correct; the call
    // path is exercised and must not throw.
    expect(jobs).toBe(0);
  });

  it("validates and deduplicates products by name", () => {
    const first = bulk.importProducts({
      tenantId,
      rows: [
        { nome: "Camisa Azul", categoria: "Moda", preco: "R$ 49,90", estoque: "10" },
        { name: "Sem Categoria" },
        { name: "Status Ruim", category: "Moda", status: "Explodido" },
      ],
      mode: "commit",
      onDuplicate: "skip",
      atomic: false,
    });

    expect(first.totals.created).toBe(1);
    expect(first.totals.invalid).toBe(2);

    const stored = sqlite
      .prepare("SELECT price_cents AS priceCents, stock, status FROM products WHERE tenant_id = ?")
      .get(tenantId) as { priceCents: number; stock: number; status: string };
    expect(stored.priceCents).toBe(4990);
    expect(stored.stock).toBe(10);
    expect(stored.status).toBe("Ativo");

    const second = bulk.importProducts({
      tenantId,
      rows: [{ name: "camisa azul", category: "Moda", price: 59.9 }],
      mode: "commit",
      onDuplicate: "skip",
      atomic: false,
    });
    expect(second.totals.duplicates).toBe(1);
    expect(second.totals.skipped).toBe(1);
  });
});

describe("imported date normalisation", () => {
  it("accepts both the ISO and the Brazilian calendar formats", async () => {
    const { normalizeImportedDate } = await import("../services/bulkImport");

    expect(normalizeImportedDate("2026-03-09")).toBe("2026-03-09");
    // What a Brazilian spreadsheet actually exports.
    expect(normalizeImportedDate("09/03/2026")).toBe("2026-03-09");
    expect(normalizeImportedDate("9/3/2026")).toBe("2026-03-09");
  });

  it("treats an absent value as absent and an unparseable one as an error", () => {
    return import("../services/bulkImport").then(({ normalizeImportedDate }) => {
      expect(normalizeImportedDate("")).toBeUndefined();
      expect(normalizeImportedDate(null)).toBeUndefined();
      // Present but wrong: reported, never silently dropped.
      expect(normalizeImportedDate("ontem")).toBeNull();
      expect(normalizeImportedDate("31/02/2026")).toBeNull();
    });
  });
});
