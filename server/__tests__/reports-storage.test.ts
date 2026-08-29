import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sqlite } from "../db";
import { DatabaseStorage } from "../storage";

const storage = new DatabaseStorage();

describe("tenant-scoped integer sales reports", () => {
  it("bootstraps authoritative integer money and category snapshot columns", () => {
    const productColumns = sqlite.prepare("PRAGMA table_info(products)").all() as Array<{
      name: string;
    }>;
    const customerColumns = sqlite.prepare("PRAGMA table_info(customers)").all() as Array<{
      name: string;
    }>;
    const itemColumns = sqlite.prepare("PRAGMA table_info(order_items)").all() as Array<{
      name: string;
    }>;
    expect(productColumns.some((column) => column.name === "price_cents")).toBe(true);
    expect(customerColumns.some((column) => column.name === "ltv_cents")).toBe(true);
    expect(itemColumns.some((column) => column.name === "category_snapshot")).toBe(true);
    expect(
      sqlite.prepare("SELECT 1 FROM schema_migrations WHERE version = '0007'").get(),
    ).toBeTruthy();
  });

  it("aggregates every eligible order, snapshots categories and separates homonymous customers", async () => {
    const suffix = randomUUID();
    const tenant = await storage.createTenant({
      name: "Reports",
      slug: `reports-${suffix}`,
      plan: "free",
      status: "active",
    });
    const externalTenant = await storage.createTenant({
      name: "External",
      slug: `external-reports-${suffix}`,
      plan: "free",
      status: "active",
    });
    const firstCustomer = await storage.createCustomer({
      tenantId: tenant.id,
      name: "Same Name",
      email: `first-${suffix}@example.com`,
      segment: "VIP",
      ltv: 9999,
    });
    const secondCustomer = await storage.createCustomer({
      tenantId: tenant.id,
      name: "Same Name",
      email: `second-${suffix}@example.com`,
      segment: "Novo",
      ltv: 0,
    });
    const externalCustomer = await storage.createCustomer({
      tenantId: externalTenant.id,
      name: "Same Name",
      email: `external-${suffix}@example.com`,
      segment: "VIP",
    });
    const penny = await storage.createProduct({
      tenantId: tenant.id,
      name: "Penny",
      category: "Old Category",
      price: 0.01,
      stock: 500,
      status: "Ativo",
    });
    const apparel = await storage.createProduct({
      tenantId: tenant.id,
      name: "Apparel",
      category: "Apparel",
      price: 19.99,
      stock: 10,
      status: "Ativo",
    });
    const externalProduct = await storage.createProduct({
      tenantId: externalTenant.id,
      name: "External",
      category: "External",
      price: 999,
      stock: 10,
      status: "Ativo",
    });

    await storage.createOrderWithLineItems({
      tenantId: tenant.id,
      customerId: firstCustomer.id,
      customer: firstCustomer.name,
      method: "cash",
      orderDate: "2025-01-01",
      lineItems: [{ productId: penny.id, quantity: 1 }],
    });
    await storage.updateProduct(tenant.id, penny.id, { category: "New Category" });
    for (let index = 0; index < 100; index += 1) {
      await storage.createOrderWithLineItems({
        tenantId: tenant.id,
        customerId: firstCustomer.id,
        customer: firstCustomer.name,
        method: "cash",
        orderDate: "2025-01-15",
        lineItems: [{ productId: penny.id, quantity: 1 }],
      });
    }
    await storage.createOrderWithLineItems({
      tenantId: tenant.id,
      customerId: secondCustomer.id,
      customer: secondCustomer.name,
      method: "cash",
      orderDate: "2025-02-01",
      lineItems: [{ productId: apparel.id, quantity: 1 }],
    });
    const cancelled = await storage.createOrderWithLineItems({
      tenantId: tenant.id,
      customerId: firstCustomer.id,
      customer: firstCustomer.name,
      method: "cash",
      orderDate: "2025-02-02",
      lineItems: [{ productId: apparel.id, quantity: 1 }],
    });
    await storage.cancelOrder(tenant.id, cancelled.id);
    await storage.createOrderWithLineItems({
      tenantId: externalTenant.id,
      customerId: externalCustomer.id,
      customer: externalCustomer.name,
      method: "cash",
      orderDate: "2025-01-01",
      lineItems: [{ productId: externalProduct.id, quantity: 1 }],
    });
    await storage.createCampaign({
      tenantId: tenant.id,
      name: "No attribution",
      channel: "email",
      audience: "all",
      sent: 50,
      openRate: 99,
      conversion: 88,
      revenue: 777,
      status: "sent",
    });

    const report = await storage.getSalesReport(tenant.id, {
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      timezone: "UTC",
    });

    expect(report.summary).toMatchObject({
      totalRevenueCents: 2100,
      totalRevenue: 21,
      totalOrders: 102,
      averageTicketCents: 21,
      totalCustomers: 2,
      totalProducts: 2,
    });
    expect(report.orders).toHaveLength(102);
    expect(report.orders.every((order) => order.status !== "Cancelado")).toBe(true);
    expect(report.salesByMonth).toEqual([
      { name: "2025-01", month: "2025-01", sales: 1.01, salesCents: 101, orders: 101 },
      { name: "2025-02", month: "2025-02", sales: 19.99, salesCents: 1999, orders: 1 },
    ]);
    expect(report.salesByCategory).toEqual(
      expect.arrayContaining([
        { name: "Old Category", value: 0.01, valueCents: 1, quantity: 1 },
        { name: "New Category", value: 1, valueCents: 100, quantity: 100 },
        { name: "Apparel", value: 19.99, valueCents: 1999, quantity: 1 },
      ]),
    );
    expect(
      report.topCustomers
        .filter((customer) => customer.name === "Same Name")
        .map(({ id, totalSpentCents, orderCount }) => ({ id, totalSpentCents, orderCount })),
    ).toEqual([
      { id: secondCustomer.id, totalSpentCents: 1999, orderCount: 1 },
      { id: firstCustomer.id, totalSpentCents: 101, orderCount: 101 },
    ]);
    expect(report.topCustomers[0]).toMatchObject({
      id: secondCustomer.id,
      totalSpentCents: 1999,
      orderCount: 1,
    });
    expect(report.campaignStats[0]).toMatchObject({
      sent: 50,
      openRate: 0,
      conversion: 0,
      revenue: 0,
      metricsAvailable: false,
      unavailableReason: "attribution_events_not_implemented",
    });

    const customer360 = await storage.getCustomer360(tenant.id, firstCustomer.id);
    expect(customer360).toMatchObject({
      totalOrders: 101,
      totalSpent: 1.01,
      totalSpentCents: 101,
      averageOrderValue: 0.01,
      averageOrderValueCents: 1,
    });
    expect(customer360?.lastOrder?.status).not.toBe("Cancelado");
    expect(customer360?.lastOrder?.orderDate).toBe("2025-01-15");

    const history = await storage.getCustomerOrderHistory(tenant.id, firstCustomer.id);
    expect(history).toMatchObject({
      totalOrders: 101,
      totalSpent: 1.01,
      totalSpentCents: 101,
    });
    expect(history.orders).toHaveLength(101);
    expect(history.orders.every((order) => order.customerId === firstCustomer.id)).toBe(true);
    expect(history.orders.every((order) => order.status !== "Cancelado")).toBe(true);

    expect(await storage.getDashboardStats(tenant.id)).toMatchObject({
      totalRevenue: 21,
      totalRevenueCents: 2100,
      totalOrders: 102,
      averageTicket: 0.21,
      averageTicketCents: 21,
    });

    await storage.createOrderWithLineItems({
      tenantId: tenant.id,
      customerId: firstCustomer.id,
      customer: firstCustomer.name,
      method: "cash",
      lineItems: [{ productId: penny.id, quantity: 1 }],
    });
    const currentCancelled = await storage.createOrderWithLineItems({
      tenantId: tenant.id,
      customerId: firstCustomer.id,
      customer: firstCustomer.name,
      method: "cash",
      lineItems: [{ productId: apparel.id, quantity: 1 }],
    });
    await storage.cancelOrder(tenant.id, currentCancelled.id);
    const charts = await storage.getDashboardCharts(tenant.id);
    expect(charts.revenueByMonth.reduce((sum, month) => sum + month.revenueCents, 0)).toBe(1);
    expect(charts.revenueByMonth.reduce((sum, month) => sum + month.revenue, 0)).toBe(0.01);

    expect(await storage.deleteTenant(tenant.id)).toBe(true);
    expect(await storage.deleteTenant(externalTenant.id)).toBe(true);
  });

  it("rejects incomplete, inverted or unapproved timezone ranges", async () => {
    await expect(
      storage.getSalesReport(1, { startDate: "2025-01-01", timezone: "UTC" }),
    ).rejects.toThrow(/provided together/);
    await expect(
      storage.getSalesReport(1, {
        startDate: "2025-02-01",
        endDate: "2025-01-01",
        timezone: "UTC",
      }),
    ).rejects.toThrow(/Invalid UTC/);
    await expect(
      storage.getSalesReport(1, { timezone: "America/Sao_Paulo" } as never),
    ).rejects.toThrow(/Only UTC/);
  });
});
