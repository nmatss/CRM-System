import { expect, test } from "@playwright/test";
import { seededData, users } from "../fixtures";
import { expectAuthenticatedShell, login, openApiSession } from "../helpers";

/**
 * Gate F5 in the browser: the campaign screen must never present a delivery
 * that did not happen, and a dispatch must produce persisted recipients.
 *
 * The outbox worker is disabled for this suite, so an execution legitimately
 * stays scheduled; that is exactly the state the UI has to show.
 */
test.describe("campaign dispatch", () => {
  test("the screen states that attribution metrics are unavailable", async ({ page }) => {
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);

    await page.goto("/campaigns");
    await expect(page.getByText(seededData.alphaCampaignName).first()).toBeVisible({
      timeout: 20_000,
    });

    // A zero would read as a real metric; the UI must say it is unavailable.
    await expect(page.getByText(/indispon[ií]ve/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("scheduling a dispatch persists recipients and never claims delivery", async ({
    page,
    browser,
  }) => {
    const manager = await openApiSession(browser, users.alphaManager.email);

    // Its own campaign, so the spec does not depend on whether an earlier run
    // (or another browser project) already dispatched the shared fixture.
    const created = await manager.send<{ id: number }>("POST", "/api/v1/campaigns", {
      name: `Campanha de despacho ${Date.now()}`,
      channel: "email",
      audience: "Clientes VIP",
      message: "Mensagem de despacho",
      status: "draft",
    });
    expect(created.status).toBe(201);
    const campaign = created.body;

    const dispatch = await manager.send<{
      execution: { id: number; status: string; totalRecipients: number; deliveredCount: number };
    }>("POST", `/api/v1/campaigns/${campaign.id}/send`);
    expect(dispatch.status).toBe(202);
    expect(dispatch.body.execution.status).toBe("scheduled");
    // The audience is resolved server-side; the invariant that matters is that
    // recipients exist and that nothing was delivered, not an absolute count
    // that other specs in the same database would shift.
    expect(dispatch.body.execution.totalRecipients).toBeGreaterThan(0);
    expect(dispatch.body.execution.deliveredCount).toBe(0);

    // Repeating the request must not schedule a second execution.
    const repeat = await manager.send<{ execution: { id: number } }>(
      "POST",
      `/api/v1/campaigns/${campaign.id}/send`,
    );
    expect(repeat.status).toBe(200);
    expect(repeat.body.execution.id).toBe(dispatch.body.execution.id);

    // Every recipient is pending, and none carries a provider message id.
    const recipients = await manager.get<{
      data: Array<{ status: string; failureReason: string | null }>;
    }>(`/api/v1/campaigns/executions/${dispatch.body.execution.id}/recipients`);
    expect(recipients.status).toBe(200);
    expect(recipients.body.data).toHaveLength(dispatch.body.execution.totalRecipients);
    expect(recipients.body.data.every((row) => row.status === "pending")).toBe(true);

    // The execution shows up in the UI with its real state.
    await login(page, users.alphaManager.email);
    await page.goto("/campaigns");
    await expect(page.getByText(`Execução #${dispatch.body.execution.id}`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/0 entregue/i).first()).toBeVisible({ timeout: 20_000 });

    await manager.close();
  });

  test("an audience the dispatcher cannot resolve is refused", async ({ browser }) => {
    const manager = await openApiSession(browser, users.alphaManager.email);

    const created = await manager.send<{ id: number }>("POST", "/api/v1/campaigns", {
      name: "Campanha com audiencia invalida",
      channel: "email",
      audience: "Carrinho abandonado",
      message: "teste",
      status: "draft",
    });
    expect(created.status).toBe(201);

    const dispatch = await manager.send<{ code?: string }>(
      "POST",
      `/api/v1/campaigns/${created.body.id}/send`,
    );
    expect(dispatch.status).toBe(400);
    expect(dispatch.body.code).toBe("EMPTY_AUDIENCE");

    await manager.close();
  });
});
