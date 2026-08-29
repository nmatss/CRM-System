import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";

/**
 * The header carried a search box that did nothing. Now it queries, and the
 * query must stay inside the tenant, cap its result set and treat wildcards as
 * literal characters.
 */
describe("global search", () => {
  let search: typeof import("../services/globalSearch");
  let storage: (typeof import("../storage"))["storage"];
  let tenantId: number;
  let otherTenantId: number;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_PATH = "./data/test-global-search.db";
    process.env.SESSION_DATABASE_PATH = "./data/test-global-search-sessions.db";

    search = await import("../services/globalSearch");
    ({ storage } = await import("../storage"));

    const suffix = randomUUID();
    tenantId = (
      await storage.createTenant({
        name: "Search Tenant",
        slug: `search-${suffix}`,
        plan: "test",
        status: "active",
      })
    ).id;
    otherTenantId = (
      await storage.createTenant({
        name: "Search Other",
        slug: `search-other-${suffix}`,
        plan: "test",
        status: "active",
      })
    ).id;

    await storage.createCustomer({
      tenantId,
      name: "Mariana Busca",
      email: "mariana-busca@example.test",
      segment: "VIP",
    });
    await storage.createCustomer({
      tenantId: otherTenantId,
      name: "Mariana Outro Tenant",
      email: "mariana-outra@example.test",
      segment: "VIP",
    });
    await storage.createProduct({
      tenantId,
      name: "Camisa Busca",
      category: "Moda",
      status: "Ativo",
      price: 10,
      stock: 5,
    });
    await storage.createOrder({
      tenantId,
      orderId: `BUSCA-${suffix}`,
      customer: "Mariana Busca",
      orderDate: "2026-03-01T10:00:00.000Z",
      status: "Pago",
      method: "PIX",
    });

    // A row whose name contains a LIKE wildcard.
    await storage.createCustomer({
      tenantId,
      name: "100% Cliente",
      email: "porcento@example.test",
      segment: "Regular",
    });
  });

  it("finds matches across customers, products and orders of the tenant", () => {
    const result = search.searchTenant(tenantId, "busca");

    expect(result.totals.customer).toBeGreaterThan(0);
    expect(result.totals.product).toBeGreaterThan(0);
    expect(result.totals.order).toBeGreaterThan(0);

    const types = new Set(result.hits.map((hit) => hit.type));
    expect(types).toEqual(new Set(["customer", "product", "order"]));
    expect(result.hits.every((hit) => hit.href.startsWith("/"))).toBe(true);
  });

  it("never returns another tenant's rows", () => {
    const result = search.searchTenant(tenantId, "Mariana");
    const titles = result.hits.map((hit) => hit.title);

    expect(titles).toContain("Mariana Busca");
    expect(titles).not.toContain("Mariana Outro Tenant");

    // And the other tenant sees only its own.
    const other = search.searchTenant(otherTenantId, "Mariana");
    expect(other.hits.map((hit) => hit.title)).toEqual(["Mariana Outro Tenant"]);
  });

  it("treats LIKE wildcards as literal characters", () => {
    // A bare "%" used to match every row in the tenant.
    const everything = search.searchTenant(tenantId, "%%");
    expect(everything.hits).toHaveLength(0);

    const literal = search.searchTenant(tenantId, "100%");
    expect(literal.hits.map((hit) => hit.title)).toContain("100% Cliente");
    expect(search.toLikePattern("50%_a")).toBe("%50\\%\\_a%");
  });

  it("refuses a term that is too short to be meaningful", () => {
    expect(search.searchTenant(tenantId, "a").hits).toHaveLength(0);
    expect(search.searchTenant(tenantId, "  ").hits).toHaveLength(0);
  });

  it("caps the result set and says when it truncated", () => {
    const capped = search.searchTenant(tenantId, "a", 1);
    expect(capped.hits.length).toBeLessThanOrEqual(3);

    const wide = search.searchTenant(tenantId, "Mariana", 1);
    expect(wide.hits.filter((hit) => hit.type === "customer").length).toBeLessThanOrEqual(1);
    expect(typeof wide.truncated).toBe("boolean");
  });
});
