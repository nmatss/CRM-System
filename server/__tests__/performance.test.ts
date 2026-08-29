import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";

/**
 * Gate F8: the read paths must stay usable with a representative volume, not
 * only with the handful of rows the other suites create.
 *
 * The budgets below are deliberately generous relative to the measured times:
 * this test exists to catch an accidental full scan or an N+1, not to police
 * millisecond drift on a shared CI runner.
 */

const CUSTOMERS = 4000;
const PRODUCTS = 500;
const ORDERS = 4000;

interface Budget {
  name: string;
  budgetMs: number;
  run: () => Promise<unknown>;
}

describe("performance with a representative volume", () => {
  let storage: (typeof import("../storage"))["storage"];
  let sqlite: (typeof import("../db"))["sqlite"];
  let tenantId: number;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_PATH = "./data/test-performance.db";
    process.env.SESSION_DATABASE_PATH = "./data/test-performance-sessions.db";

    ({ storage } = await import("../storage"));
    ({ sqlite } = await import("../db"));

    const suffix = randomUUID();
    tenantId = (
      await storage.createTenant({
        name: "Performance Tenant",
        slug: `perf-${suffix}`,
        plan: "test",
        status: "active",
      })
    ).id;

    // Bulk-insert with raw SQL: the point is to measure reads, not writes.
    const insertCustomer = sqlite.prepare(
      "INSERT INTO customers (tenant_id, name, email, segment, ltv, ltv_cents) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const insertProduct = sqlite.prepare(
      "INSERT INTO products (tenant_id, name, category, status, price, price_cents, stock) VALUES (?, ?, ?, 'Ativo', ?, ?, 1000000)",
    );
    const insertOrder = sqlite.prepare(
      `INSERT INTO orders (tenant_id, order_id, customer_id, customer, order_date, total, total_cents, status, items, method)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pago', 1, 'PIX')`,
    );
    const insertItem = sqlite.prepare(
      `INSERT INTO order_items (tenant_id, order_id, product_id, category_snapshot, quantity, unit_price_cents, line_total_cents)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
    );

    const segments = ["VIP", "Novo", "Regular", "Inativo", "Em Risco"];
    const categories = ["Moda", "Casa", "Eletro", "Beleza"];

    sqlite.transaction(() => {
      for (let i = 0; i < PRODUCTS; i += 1) {
        insertProduct.run(
          tenantId,
          `Produto ${i}`,
          categories[i % categories.length],
          (i % 100) + 1,
          ((i % 100) + 1) * 100,
        );
      }
      for (let i = 0; i < CUSTOMERS; i += 1) {
        insertCustomer.run(
          tenantId,
          `Cliente ${String(i).padStart(5, "0")}`,
          `perf-${i}-${suffix}@example.test`,
          segments[i % segments.length],
          0,
          0,
        );
      }
    })();

    const productIds = (
      sqlite
        .prepare("SELECT id FROM products WHERE tenant_id = ? LIMIT ?")
        .all(tenantId, PRODUCTS) as Array<{
        id: number;
      }>
    ).map((row) => row.id);
    const customerIds = (
      sqlite
        .prepare("SELECT id FROM customers WHERE tenant_id = ? LIMIT ?")
        .all(tenantId, CUSTOMERS) as Array<{ id: number }>
    ).map((row) => row.id);

    sqlite.transaction(() => {
      for (let i = 0; i < ORDERS; i += 1) {
        const priceCents = ((i % 100) + 1) * 100;
        const day = String((i % 28) + 1).padStart(2, "0");
        const info = insertOrder.run(
          tenantId,
          `PERF-${i}`,
          customerIds[i % customerIds.length],
          `Cliente ${i % customerIds.length}`,
          `2026-03-${day} 12:00:00`,
          priceCents / 100,
          priceCents,
        );
        insertItem.run(
          tenantId,
          Number(info.lastInsertRowid),
          productIds[i % productIds.length],
          categories[i % categories.length],
          priceCents,
          priceCents,
        );
      }
    })();
  }, 120_000);

  async function measure(budget: Budget) {
    // One warm-up so the first-call query planning is not charged to the budget.
    await budget.run();
    const start = process.hrtime.bigint();
    const result = await budget.run();
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    if (process.env.PERF_VERBOSE === "true") {
      console.log(`PERF ${budget.name}: ${elapsedMs.toFixed(1)}ms (budget ${budget.budgetMs}ms)`);
    }
    return { elapsedMs, result };
  }

  it("keeps the seeded volume in one tenant", () => {
    const counts = sqlite
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM customers WHERE tenant_id = @tenantId) AS customers,
           (SELECT COUNT(*) FROM products WHERE tenant_id = @tenantId) AS products,
           (SELECT COUNT(*) FROM orders WHERE tenant_id = @tenantId) AS orders,
           (SELECT COUNT(*) FROM order_items WHERE tenant_id = @tenantId) AS items`,
      )
      .get({ tenantId }) as Record<string, number>;

    expect(counts.customers).toBeGreaterThanOrEqual(CUSTOMERS);
    expect(counts.orders).toBeGreaterThanOrEqual(ORDERS);
    expect(counts.items).toBeGreaterThanOrEqual(ORDERS);
  });

  it("paginates a large customer list without scanning everything", async () => {
    const { elapsedMs, result } = await measure({
      name: "customers page",
      budgetMs: 400,
      run: () => storage.getCustomers(tenantId, { limit: 50, offset: 0 }),
    });

    const page = result as { data: unknown[]; total: number };
    expect(page.data).toHaveLength(50);
    expect(page.total).toBeGreaterThanOrEqual(CUSTOMERS);
    expect(elapsedMs, `customer listing took ${elapsedMs.toFixed(1)}ms`).toBeLessThan(400);
  });

  it("reaches a deep page without degrading beyond the budget", async () => {
    const { elapsedMs } = await measure({
      name: "deep page",
      budgetMs: 500,
      run: () => storage.getCustomers(tenantId, { limit: 50, offset: CUSTOMERS - 60 }),
    });

    expect(elapsedMs, `deep page took ${elapsedMs.toFixed(1)}ms`).toBeLessThan(500);
  });

  it("filters and searches within budget", async () => {
    const { elapsedMs, result } = await measure({
      name: "search",
      budgetMs: 500,
      run: () => storage.getCustomers(tenantId, { limit: 50, offset: 0, search: "Cliente 003" }),
    });

    expect((result as { total: number }).total).toBeGreaterThan(0);
    expect(elapsedMs, `search took ${elapsedMs.toFixed(1)}ms`).toBeLessThan(500);
  });

  it("aggregates the sales report over the whole range within budget", async () => {
    const { elapsedMs, result } = await measure({
      name: "sales report",
      budgetMs: 1500,
      run: () =>
        storage.getSalesReport(tenantId, {
          timezone: "UTC",
          startDate: "2026-03-01",
          endDate: "2026-03-31",
        }),
    });

    const report = result as { summary: { totalOrders: number } };
    expect(report.summary.totalOrders).toBeGreaterThan(0);
    expect(elapsedMs, `sales report took ${elapsedMs.toFixed(1)}ms`).toBeLessThan(1500);
  });

  it("composes the dashboard within budget", async () => {
    const { elapsedMs } = await measure({
      name: "dashboard",
      budgetMs: 1500,
      run: () => storage.getDashboardStats(tenantId),
    });

    expect(elapsedMs, `dashboard took ${elapsedMs.toFixed(1)}ms`).toBeLessThan(1500);
  });

  it("claims an outbox job in constant time regardless of backlog", async () => {
    const { enqueueJob, claimNextJob } = await import("../outbox");

    sqlite.transaction(() => {
      for (let i = 0; i < 2000; i += 1) {
        enqueueJob({
          tenantId,
          type: "perf.noop",
          idempotencyKey: `perf-${i}`,
          payload: { i },
        });
      }
    })();

    const start = process.hrtime.bigint();
    const claimed = claimNextJob("perf-worker", 60_000);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    expect(claimed).not.toBeNull();
    // The claim is driven by an index on (status, available_at).
    expect(elapsedMs, `claim took ${elapsedMs.toFixed(1)}ms`).toBeLessThan(100);
  });

  it("keeps health and readiness cheap", async () => {
    const start = process.hrtime.bigint();
    await storage.healthCheck();
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    expect(elapsedMs, `health check took ${elapsedMs.toFixed(1)}ms`).toBeLessThan(100);
  });
});
