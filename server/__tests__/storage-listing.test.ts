import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";

describe("tenant-scoped storage listing", () => {
  let storage: (typeof import("../storage"))["storage"];
  let sqlite: (typeof import("../db"))["sqlite"];
  let tenantId: number;
  let otherTenantId: number;
  let stockProductId: number;
  let noStockProductId: number;
  let externalProductId: number;
  let ledgerCustomerId: number;
  let externalCustomerId: number;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_PATH = "./data/test-storage-listing.db";
    process.env.SESSION_DATABASE_PATH = "./data/test-storage-listing-sessions.db";

    ({ storage } = await import("../storage"));
    ({ sqlite } = await import("../db"));

    const suffix = randomUUID();
    const tenant = await storage.createTenant({
      name: "Listing Tenant",
      slug: `listing-${suffix}`,
      plan: "test",
      status: "active",
    });
    const otherTenant = await storage.createTenant({
      name: "Other Listing Tenant",
      slug: `listing-other-${suffix}`,
      plan: "test",
      status: "active",
    });
    tenantId = tenant.id;
    otherTenantId = otherTenant.id;

    const alphaCustomer = await storage.createCustomer({
      tenantId,
      name: "Alpha Moda",
      email: "alpha-listing@example.com",
      segment: "VIP",
    });
    ledgerCustomerId = alphaCustomer.id;
    const zuluCustomer = await storage.createCustomer({
      tenantId,
      name: "Zulu Moda",
      email: "zulu-listing@example.com",
      segment: "VIP",
    });
    await storage.createCustomer({
      tenantId,
      name: "Regular Sem Busca",
      email: "regular-listing@example.com",
      segment: "Regular",
    });
    const externalCustomer = await storage.createCustomer({
      tenantId: otherTenantId,
      name: "Aardvark Moda Externa",
      email: "external-listing@example.com",
      segment: "VIP",
    });
    externalCustomerId = externalCustomer.id;

    const stockProduct = await storage.createProduct({
      tenantId,
      name: "Camisa Alpha",
      category: "Moda",
      status: "Ativo",
      price: 12.34,
      stock: 5,
    });
    stockProductId = stockProduct.id;
    const noStockProduct = await storage.createProduct({
      tenantId,
      name: "Camisa Zulu",
      category: "Moda",
      status: "Ativo",
      price: 7.5,
      stock: 0,
    });
    noStockProductId = noStockProduct.id;
    await storage.createProduct({
      tenantId,
      name: "Camisa Inativa",
      category: "Moda",
      status: "Inativo",
    });
    const externalProduct = await storage.createProduct({
      tenantId: otherTenantId,
      name: "Camisa Externa",
      category: "Moda",
      status: "Ativo",
      price: 99,
      stock: 10,
    });
    externalProductId = externalProduct.id;

    await storage.createOrder({
      tenantId,
      orderId: `ORDER-OLD-${suffix}`,
      customerId: alphaCustomer.id,
      customer: "Cliente Alpha",
      orderDate: "2026-01-01T10:00:00.000Z",
      status: "Pago",
      method: "PIX",
    });
    await storage.createOrder({
      tenantId,
      orderId: `ORDER-NEW-${suffix}`,
      customerId: zuluCustomer.id,
      customer: "Cliente Zulu",
      orderDate: "2026-02-01T10:00:00.000Z",
      status: "Pago",
      method: "PIX",
    });
    await storage.createOrder({
      tenantId: otherTenantId,
      orderId: `ORDER-EXTERNAL-${suffix}`,
      customerId: externalCustomer.id,
      customer: "Cliente Externo",
      orderDate: "2026-03-01T10:00:00.000Z",
      status: "Pago",
      method: "PIX",
    });
  });

  afterAll(async () => {
    if (tenantId) await storage.deleteTenant(tenantId);
    if (otherTenantId) await storage.deleteTenant(otherTenantId);
  });

  it("applies customer search, segment, ordering, tenant scope, and filtered total", async () => {
    const result = await storage.getCustomers(tenantId, {
      search: "moda",
      segment: "VIP",
      sort: "name",
      order: "asc",
      limit: 1,
      offset: 0,
    });

    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Alpha Moda");
    expect(result.data.every((customer) => customer.tenantId === tenantId)).toBe(true);
  });

  it("applies product search, status, descending order, tenant scope, and filtered total", async () => {
    const result = await storage.getProducts(tenantId, {
      search: "camisa",
      status: "Ativo",
      sort: "name",
      order: "desc",
      limit: 1,
      offset: 0,
    });

    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Camisa Zulu");
    expect(result.data.every((product) => product.tenantId === tenantId)).toBe(true);
  });

  it("applies order search, status, date order, tenant scope, and filtered total", async () => {
    const result = await storage.getOrders(tenantId, {
      search: "cliente",
      status: "Pago",
      sort: "orderDate",
      order: "desc",
      limit: 1,
      offset: 0,
    });

    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].customer).toBe("Cliente Zulu");
    expect(result.data.every((order) => order.tenantId === tenantId)).toBe(true);
  });

  it("creates item snapshots, updates stock atomically, and cancels idempotently", async () => {
    const created = await storage.createOrderWithLineItems({
      tenantId,
      customer: "Snapshot Customer",
      method: "PIX",
      lineItems: [
        { productId: stockProductId, quantity: 1 },
        { productId: stockProductId, quantity: 1 },
      ],
    });

    expect(created.orderId).toMatch(/^ORD-[0-9a-f-]{36}$/);
    expect(created.totalCents).toBe(2468);
    expect(created.total).toBe(24.68);
    expect(created.items).toBe(2);
    expect(created.status).toBe("Pendente");
    expect((await storage.getProduct(tenantId, stockProductId))?.stock).toBe(3);
    expect(await storage.getOrderItems(tenantId, created.id)).toMatchObject([
      {
        tenantId,
        orderId: created.id,
        productId: stockProductId,
        quantity: 2,
        unitPriceCents: 1234,
        lineTotalCents: 2468,
      },
    ]);

    expect((await storage.cancelOrder(tenantId, created.id))?.status).toBe("Cancelado");
    expect((await storage.getProduct(tenantId, stockProductId))?.stock).toBe(5);

    const afterDerivedUpdate = await storage.updateOrder(tenantId, created.id, {
      orderId: "FORGED",
      total: 0,
      totalCents: 0,
      items: 0,
      lineItems: [{ productId: externalProductId, quantity: 99 }],
    } as any);
    expect(afterDerivedUpdate).toMatchObject({
      orderId: created.orderId,
      total: 24.68,
      totalCents: 2468,
      items: 2,
      status: "Cancelado",
    });
    expect((await storage.cancelOrder(tenantId, created.id))?.status).toBe("Cancelado");
    expect((await storage.getProduct(tenantId, stockProductId))?.stock).toBe(5);
  });

  it("aggregates tenant-scoped top products from active order item cents", async () => {
    await storage.createOrderWithLineItems({
      tenantId,
      customer: "Chart Customer",
      method: "PIX",
      lineItems: [{ productId: stockProductId, quantity: 1 }],
    });
    const charts = await storage.getDashboardCharts(tenantId);
    expect(charts.topProducts).toContainEqual({
      name: "Camisa Alpha",
      revenue: 12.34,
      quantity: 1,
    });
    expect(charts.topProducts.every((product) => product.name !== "Camisa Externa")).toBe(true);
  });

  it("rolls back stock and order writes on insufficient stock or cross-tenant products", async () => {
    const beforeOrders = (await storage.getOrders(tenantId)).total;
    const beforeStock = (await storage.getProduct(tenantId, stockProductId))?.stock;

    await expect(
      storage.createOrderWithLineItems({
        tenantId,
        customer: "No Stock Customer",
        method: "PIX",
        lineItems: [
          { productId: stockProductId, quantity: 1 },
          { productId: noStockProductId, quantity: 1 },
        ],
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect((await storage.getProduct(tenantId, stockProductId))?.stock).toBe(beforeStock);
    expect((await storage.getOrders(tenantId)).total).toBe(beforeOrders);

    await expect(
      storage.createOrderWithLineItems({
        tenantId,
        customer: "External Product Customer",
        method: "PIX",
        lineItems: [{ productId: externalProductId, quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: "INVALID_TENANT_REFERENCE" });
    expect((await storage.getProduct(otherTenantId, externalProductId))?.stock).toBe(10);
    expect((await storage.getOrders(tenantId)).total).toBe(beforeOrders);

    await expect(
      storage.createOrderWithLineItems({
        tenantId,
        customer: "Cancelled At Creation",
        method: "PIX",
        status: "Cancelado",
        lineItems: [{ productId: stockProductId, quantity: 1 }],
      }),
    ).rejects.toThrow(/non-cancelled initial status/);
    expect((await storage.getProduct(tenantId, stockProductId))?.stock).toBe(beforeStock);
    expect((await storage.getOrders(tenantId)).total).toBe(beforeOrders);
  });

  it("maintains an idempotent FIFO cashback ledger with safe reversal and reconciliation", async () => {
    const operation = {
      customerId: ledgerCustomerId,
      amountCents: 1000,
      idempotencyKey: "credit-ledger-1",
      description: "Credit one",
      source: "manual",
      expiresAt: "2028-12-01T00:00:00.000Z",
    } as const;
    const [first, retry] = await Promise.all([
      storage.creditCashback(tenantId, operation),
      storage.creditCashback(tenantId, operation),
    ]);
    expect(retry.id).toBe(first.id);
    await expect(
      storage.creditCashback(tenantId, {
        customerId: ledgerCustomerId,
        amountCents: 999,
        idempotencyKey: "credit-ledger-1",
        description: "Changed",
        source: "manual",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

    const debit = await storage.debitCashback(tenantId, {
      customerId: ledgerCustomerId,
      amountCents: 400,
      idempotencyKey: "debit-ledger-1",
      description: "Redeem",
      source: "redemption",
    });
    expect(debit.balanceCents).toBe(600);
    await expect(
      storage.reverseCashback(tenantId, first.id, "reverse-credit-consumed"),
    ).rejects.toMatchObject({ code: "REVERSAL_NOT_ALLOWED" });
    const reversal = await storage.reverseCashback(tenantId, debit.id, "reverse-debit-ledger");
    expect(reversal.balanceCents).toBe(1000);
    expect((await storage.reverseCashback(tenantId, debit.id, "reverse-debit-ledger")).id).toBe(
      reversal.id,
    );
    expect(await storage.reconcileCashback(tenantId, ledgerCustomerId)).toEqual([
      expect.objectContaining({
        accountBalanceCents: 1000,
        lotBalanceCents: 1000,
        ledgerBalanceCents: 1000,
        consistent: true,
      }),
    ]);

    const expiringCredit = await storage.creditCashback(tenantId, {
      customerId: ledgerCustomerId,
      amountCents: 200,
      idempotencyKey: "expired-reversal-credit",
      description: "Will expire",
      source: "manual",
      expiresAt: "2028-01-01T00:00:00.000Z",
    });
    const expiringDebit = await storage.debitCashback(tenantId, {
      customerId: ledgerCustomerId,
      amountCents: 1100,
      idempotencyKey: "expired-reversal-debit",
      description: "Uses expiring allocation",
      source: "redemption",
    });
    sqlite
      .prepare(
        "UPDATE cashback_credit_lots SET expires_at='2020-01-01T00:00:00.000Z' WHERE credit_transaction_id=?",
      )
      .run(expiringCredit.id);
    await expect(
      storage.reverseCashback(tenantId, expiringDebit.id, "reverse-expired-debit"),
    ).rejects.toMatchObject({ code: "REVERSAL_NOT_ALLOWED" });

    await expect(
      storage.creditCashback(tenantId, {
        customerId: externalCustomerId,
        amountCents: 100,
        idempotencyKey: "cross-tenant-credit",
        description: "External",
        source: "manual",
      }),
    ).rejects.toMatchObject({ code: "INVALID_TENANT_REFERENCE" });
  });

  it("expires only remaining cents once and preserves a reconciled balance", async () => {
    const expiringCustomer = await storage.createCustomer({
      tenantId,
      name: "Expiry Customer",
      email: `expiry-${randomUUID()}@example.com`,
      segment: "Novo",
    });
    await storage.creditCashback(tenantId, {
      customerId: expiringCustomer.id,
      amountCents: 500,
      idempotencyKey: "expiry-credit-1",
      description: "Expiring",
      source: "promotion",
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
    await storage.debitCashback(tenantId, {
      customerId: expiringCustomer.id,
      amountCents: 200,
      idempotencyKey: "expiry-debit-1",
      description: "Partial use",
      source: "redemption",
    });
    const expired = await storage.expireCashback(tenantId, "2027-02-01T00:00:00.000Z");
    expect(expired).toHaveLength(1);
    expect(expired[0]).toMatchObject({ amountCents: 300, balanceCents: 0, source: "expiration" });
    expect(await storage.expireCashback(tenantId, "2027-02-01T00:00:00.000Z")).toEqual([]);
    expect(await storage.reconcileCashback(tenantId, expiringCustomer.id)).toEqual([
      expect.objectContaining({
        accountBalanceCents: 0,
        lotBalanceCents: 0,
        ledgerBalanceCents: 0,
        consistent: true,
      }),
    ]);
  });
});
