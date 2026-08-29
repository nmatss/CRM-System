import { expect, test } from "@playwright/test";
import { seededData, tenants, users } from "../fixtures";
import { expectAuthenticatedShell, login, openApiSession } from "../helpers";

/**
 * Gate F1: a tenant must never observe or reach another tenant's data, and a
 * revoked membership must lose access on the very next request.
 */
test.describe("tenant isolation", () => {
  test("a tenant only lists its own customers in the UI", async ({ page }) => {
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);

    await page.goto("/customers");
    await expect(page.getByText(seededData.alphaCustomerName).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(seededData.betaCustomerName)).toHaveCount(0);
  });

  test("the API never returns another tenant's rows", async ({ browser }) => {
    const alpha = await openApiSession(browser, users.alphaManager.email);

    const response = await alpha.get<{ data: Array<{ name: string }> }>(
      "/api/v1/customers?limit=100",
    );
    expect(response.status).toBe(200);
    const names = response.body.data.map((customer) => customer.name);

    expect(names).toContain(seededData.alphaCustomerName);
    expect(names).not.toContain(seededData.betaCustomerName);

    await alpha.close();
  });

  test("reading a foreign customer by id is refused", async ({ browser }) => {
    const beta = await openApiSession(browser, users.betaManager.email);
    const betaList = await beta.get<{ data: Array<{ id: number; name: string }> }>(
      "/api/v1/customers?limit=100",
    );
    const betaCustomerId = betaList.body.data.find(
      (c) => c.name === seededData.betaCustomerName,
    )?.id;
    expect(betaCustomerId, "the beta fixture customer must exist").toBeTruthy();

    const alpha = await openApiSession(browser, users.alphaManager.email);
    const response = await alpha.get(`/api/v1/customers/${betaCustomerId}/360`);
    expect([403, 404]).toContain(response.status);

    await beta.close();
    await alpha.close();
  });

  test("a client-supplied tenantId cannot move a record between tenants", async ({ browser }) => {
    const alpha = await openApiSession(browser, users.alphaManager.email);

    const list = await alpha.get<{ data: Array<{ id: number; name: string }> }>(
      "/api/v1/customers?limit=100",
    );
    const customer = list.body.data.find((c) => c.name === seededData.alphaCustomerName);
    expect(customer).toBeTruthy();

    const update = await alpha.send("PUT", `/api/v1/customers/${customer!.id}`, {
      name: seededData.alphaCustomerName,
      tenantId: 999999,
    });
    expect(update.status).toBe(200);

    // The record must still belong to the original tenant.
    const recheck = await alpha.get<{ data: Array<{ name: string }> }>(
      "/api/v1/customers?limit=100",
    );
    expect(recheck.body.data.map((c) => c.name)).toContain(seededData.alphaCustomerName);

    await alpha.close();
  });

  test("a relationship pointing at another tenant is rejected", async ({ browser }) => {
    const beta = await openApiSession(browser, users.betaManager.email);
    const betaList = await beta.get<{ data: Array<{ id: number; name: string }> }>(
      "/api/v1/customers?limit=100",
    );
    const betaCustomerId = betaList.body.data.find(
      (c) => c.name === seededData.betaCustomerName,
    )?.id;

    const alpha = await openApiSession(browser, users.alphaManager.email);
    const response = await alpha.send("POST", "/api/v1/seller-tasks", {
      customerId: betaCustomerId,
      type: "call",
      dueDate: "2026-12-31",
      status: "pending",
    });

    expect(response.status).toBe(400);

    await beta.close();
    await alpha.close();
  });

  test("revoking a membership blocks the next request of a live session", async ({ browser }) => {
    const betaSession = await openApiSession(browser, users.betaManager.email);

    // The session works before the revocation.
    const before = await betaSession.get("/api/v1/customers?limit=1");
    expect(before.status).toBe(200);

    // A super admin revokes the membership out of band.
    const admin = await openApiSession(browser, users.superAdmin.email);
    const allUsers = await admin.get<Array<{ id: string; email: string }>>("/api/v1/admin/users");
    const target = allUsers.body.find((user) => user.email === users.betaManager.email);
    expect(target, "the beta manager must exist").toBeTruthy();

    const allTenants =
      await admin.get<Array<{ id: number; slug: string }>>("/api/v1/admin/tenants");
    const betaTenant = allTenants.body.find((tenant) => tenant.slug === tenants.beta.slug);
    expect(betaTenant).toBeTruthy();

    const revoke = await admin.send(
      "DELETE",
      `/api/v1/admin/users/${target!.id}/tenants/${betaTenant!.id}`,
    );
    expect(revoke.status).toBe(200);

    // The already-authenticated session must be refused immediately.
    const after = await betaSession.get("/api/v1/customers?limit=1");
    expect(after.status).toBe(403);

    // Restore the fixture so the suite stays re-runnable in any order.
    const restore = await admin.send("POST", `/api/v1/admin/users/${target!.id}/tenants`, {
      tenantId: betaTenant!.id,
      role: "manager",
      isActive: true,
    });
    expect([200, 201]).toContain(restore.status);

    await betaSession.close();
    await admin.close();
  });
});
