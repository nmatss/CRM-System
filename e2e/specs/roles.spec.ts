import { expect, test } from "@playwright/test";
import { seededData, users } from "../fixtures";
import { expectAuthenticatedShell, login, openApiSession } from "../helpers";

/**
 * Gate F7: manager-only actions must be hidden from a seller in the UI, and
 * Gate F1: the server must refuse them regardless of what the UI shows.
 */
test.describe("role separation", () => {
  test("a seller does not see manager-only actions", async ({ page }) => {
    await login(page, users.alphaSeller.email);
    await expectAuthenticatedShell(page);

    await page.goto("/products");
    await expect(page.getByText(seededData.alphaProductName).first()).toBeVisible({
      timeout: 20_000,
    });
    // Product management is manager-only.
    await expect(page.getByTestId("button-add-product")).toHaveCount(0);

    await page.goto("/campaigns");
    await expect(page.getByRole("heading", { name: /campanhas/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /novo rascunho/i })).toHaveCount(0);

    await page.goto("/automations");
    await expect(page.getByRole("heading", { name: /automações/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /nova automação/i })).toHaveCount(0);
  });

  test("a manager sees the manager-only actions a seller does not", async ({ page }) => {
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);

    await page.goto("/campaigns");
    await expect(page.getByRole("button", { name: /novo rascunho/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/automations");
    await expect(page.getByRole("button", { name: /nova automação/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("only a super admin reaches the administration panel", async ({ page }) => {
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);
    await expect(page.getByTestId("nav-link-admin")).toHaveCount(0);
  });

  test("the server refuses a manager-only write from a seller session", async ({ browser }) => {
    const seller = await openApiSession(browser, users.alphaSeller.email);

    const response = await seller.send("POST", "/api/v1/campaigns", {
      name: "Nao deve existir",
      channel: "email",
      audience: "Clientes VIP",
    });

    // Authorisation lives on the server; hiding the button is not the control.
    expect(response.status).toBe(403);
    await seller.close();
  });

  test("the server refuses a state change without a CSRF token", async ({ browser }) => {
    const manager = await openApiSession(browser, users.alphaManager.email);

    const response = await manager.sendWithoutCsrf("POST", "/api/v1/customers", {
      name: "Sem CSRF",
      email: "sem-csrf@example.test",
      segment: "Regular",
    });

    expect(response.status).toBe(403);
    await manager.close();
  });
});
