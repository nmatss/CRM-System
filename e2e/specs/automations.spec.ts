import { expect, test } from "@playwright/test";
import { seededData, users } from "../fixtures";
import { expectAuthenticatedShell, login, openApiSession } from "../helpers";

/**
 * Gate F6 in the browser: an automation only executes when it is active, the
 * history reflects the database, and an unsupported trigger cannot be saved.
 */
test.describe("automations", () => {
  test("the screen shows the real definition and an empty, honest history", async ({ page }) => {
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);

    await page.goto("/automations");
    await expect(page.getByText(seededData.alphaAutomationTitle).first()).toBeVisible({
      timeout: 20_000,
    });

    // The fixture automation is paused, and no event has run yet.
    await expect(page.getByText("Pausada").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/nenhuma execução registrada/i)).toBeVisible({ timeout: 20_000 });
  });

  test("a paused automation schedules nothing when its trigger fires", async ({ browser }) => {
    const manager = await openApiSession(browser, users.alphaManager.email);

    const before = await manager.get<{ pagination: { total: number } }>(
      "/api/v1/automations/history?limit=100",
    );

    // Creating a customer fires customer.created.
    const created = await manager.send("POST", "/api/v1/customers", {
      name: "Cliente sem automacao",
      email: `sem-automacao-${Date.now()}@example.test`,
      segment: "Novo",
    });
    expect(created.status).toBe(201);

    const after = await manager.get<{ pagination: { total: number } }>(
      "/api/v1/automations/history?limit=100",
    );
    expect(after.body.pagination.total).toBe(before.body.pagination.total);

    await manager.close();
  });

  test("activating an automation enqueues work without inventing a result", async ({ browser }) => {
    const manager = await openApiSession(browser, users.alphaManager.email);

    const list = await manager.get<Array<{ id: number; title: string }>>("/api/v1/automations");
    const automation = list.body.find((item) => item.title === seededData.alphaAutomationTitle);
    expect(automation).toBeTruthy();

    const activated = await manager.send<{ isActive: boolean }>(
      "PATCH",
      `/api/v1/automations/${automation!.id}/toggle`,
    );
    expect(activated.status).toBe(200);
    expect(activated.body.isActive).toBe(true);

    const created = await manager.send("POST", "/api/v1/customers", {
      name: "Cliente com automacao",
      email: `com-automacao-${Date.now()}@example.test`,
      segment: "Novo",
    });
    expect(created.status).toBe(201);

    // The worker is disabled here, so the job exists but has not run: the
    // history must stay free of successes rather than inventing one.
    const history = await manager.get<{ data: Array<{ status: string }> }>(
      "/api/v1/automations/history?limit=100",
    );
    expect(history.body.data.every((entry) => entry.status !== "succeeded")).toBe(true);

    // Pause it again so the fixture stays as the other specs expect.
    const paused = await manager.send<{ isActive: boolean }>(
      "PATCH",
      `/api/v1/automations/${automation!.id}/toggle`,
    );
    expect(paused.body.isActive).toBe(false);

    await manager.close();
  });

  test("an unsupported trigger cannot be saved", async ({ browser }) => {
    const manager = await openApiSession(browser, users.alphaManager.email);

    const response = await manager.send("POST", "/api/v1/automations", {
      title: "Gatilho inexistente",
      description: "Nao deve ser aceita",
      icon: "Zap",
      isActive: false,
      triggerType: "cart.abandoned",
      actionType: "notify_customer",
      actionChannel: "email",
    });

    expect(response.status).toBe(400);
    await manager.close();
  });

  test("the capabilities endpoint only advertises what the server executes", async ({
    browser,
  }) => {
    const manager = await openApiSession(browser, users.alphaManager.email);

    const response = await manager.get<{
      triggers: string[];
      actions: string[];
      configuredChannels: string[];
    }>("/api/v1/automations/capabilities");
    expect(response.status).toBe(200);

    expect(response.body.triggers).toEqual(["customer.created", "order.created"]);
    expect(response.body.actions).toEqual(["notify_customer"]);
    // No provider is configured in this environment, so nothing can be sent.
    expect(response.body.configuredChannels).toEqual([]);

    await manager.close();
  });
});
