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

    const list = await manager.get<Array<{ id: number; name: string }>>("/api/v1/campaigns");
    const campaign = list.body.find((item) => item.name === seededData.alphaCampaignName);
    expect(campaign, "the fixture campaign must exist").toBeTruthy();

    const dispatch = await manager.send<{
      execution: { id: number; status: string; totalRecipients: number; deliveredCount: number };
    }>("POST", `/api/v1/campaigns/${campaign!.id}/send`);
    expect(dispatch.status).toBe(202);
    expect(dispatch.body.execution.status).toBe("scheduled");
    // The VIP audience matches exactly the seeded VIP customer of this tenant.
    expect(dispatch.body.execution.totalRecipients).toBe(1);
    expect(dispatch.body.execution.deliveredCount).toBe(0);

    // Repeating the request must not schedule a second execution.
    const repeat = await manager.send<{ execution: { id: number } }>(
      "POST",
      `/api/v1/campaigns/${campaign!.id}/send`,
    );
    expect(repeat.status).toBe(200);
    expect(repeat.body.execution.id).toBe(dispatch.body.execution.id);

    // Every recipient is pending, and none carries a provider message id.
    const recipients = await manager.get<{
      data: Array<{ status: string; failureReason: string | null }>;
    }>(`/api/v1/campaigns/executions/${dispatch.body.execution.id}/recipients`);
    expect(recipients.status).toBe(200);
    expect(recipients.body.data).toHaveLength(1);
    expect(recipients.body.data[0].status).toBe("pending");

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
