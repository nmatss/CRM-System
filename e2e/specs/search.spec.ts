import { expect, test } from "@playwright/test";
import { seededData, users } from "../fixtures";
import { expectAuthenticatedShell, login, openApiSession } from "../helpers";

/**
 * The header search box used to be inert: no handler, no request, no result.
 * These cases prove it now queries, shows what it found, navigates, and stays
 * inside the tenant.
 */
test.describe("global search", () => {
  test("typing shows real results and selecting one navigates", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);

    await page.getByTestId("input-search").fill("Cliente Alpha");

    const results = page.getByRole("region", { name: "Resultados da busca" });
    await expect(results).toBeVisible({ timeout: 20_000 });
    await expect(results.getByText(seededData.alphaCustomerName).first()).toBeVisible({
      timeout: 20_000,
    });

    await results.getByText(seededData.alphaCustomerName).first().click();
    await expect(page).toHaveURL(/\/customers$/);
    // The term is cleared once the user acted on it.
    await expect(page.getByTestId("input-search")).toHaveValue("");
  });

  test("a term with no match says so instead of staying silent", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);

    await page.getByTestId("input-search").fill("zzzzz-nao-existe-zzzzz");

    const results = page.getByRole("region", { name: "Resultados da busca" });
    await expect(results).toContainText(/nenhum resultado/i, { timeout: 20_000 });
  });

  test("the search never crosses a tenant boundary", async ({ browser }) => {
    const alpha = await openApiSession(browser, users.alphaManager.email);
    const response = await alpha.get<{ hits: Array<{ title: string }> }>(
      "/api/v1/search?q=Cliente",
    );

    expect(response.status).toBe(200);
    const titles = response.body.hits.map((hit) => hit.title);
    expect(titles).toContain(seededData.alphaCustomerName);
    expect(titles).not.toContain(seededData.betaCustomerName);

    await alpha.close();
  });

  test("a wildcard is matched literally, not as 'everything'", async ({ browser }) => {
    const alpha = await openApiSession(browser, users.alphaManager.email);

    const wildcard = await alpha.get<{ hits: unknown[] }>("/api/v1/search?q=%25%25");
    expect(wildcard.status).toBe(200);
    expect(wildcard.body.hits).toHaveLength(0);

    await alpha.close();
  });

  test("a term that is too short is refused by the server", async ({ browser }) => {
    const alpha = await openApiSession(browser, users.alphaManager.email);
    const response = await alpha.get("/api/v1/search?q=a");
    expect(response.status).toBe(400);
    await alpha.close();
  });

  test("an unauthenticated caller cannot search", async ({ page }) => {
    await page.goto("/login");
    const status = await page.evaluate(async () => {
      const r = await fetch("/api/v1/search?q=cliente", { credentials: "include" });
      return r.status;
    });
    expect(status).toBe(401);
  });
});
