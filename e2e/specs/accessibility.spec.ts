import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { users } from "../fixtures";
import { expectAuthenticatedShell, login } from "../helpers";

/**
 * Gate F7: axe must find no critical violation, and the main flow must be
 * usable from the keyboard alone.
 */

/** Runs axe and returns only the violations that block use of the page. */
async function criticalViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  return results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
}

function describeViolations(violations: Awaited<ReturnType<typeof criticalViolations>>) {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}) on ${violation.nodes.length} node(s): ${violation.help}`,
    )
    .join("\n");
}

test.describe("accessibility", () => {
  test("the login page has no critical or serious violation", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-card")).toBeVisible();

    const violations = await criticalViolations(page);
    expect(describeViolations(violations)).toBe("");
  });

  test("the authenticated pages have no critical or serious violation", async ({ page }) => {
    test.slow();
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);

    for (const path of [
      "/dashboard",
      "/customers",
      "/campaigns",
      "/automations",
      "/orders",
      "/products",
      "/reports",
      "/settings",
      "/agenda",
      "/cashback",
    ]) {
      await page.goto(path);
      await expectAuthenticatedShell(page);
      // Let the data-driven regions settle before scanning.
      await page.waitForTimeout(500);

      const violations = await criticalViolations(page);
      expect(describeViolations(violations), `violations on ${path}`).toBe("");
    }
  });

  test("the login form can be completed with the keyboard alone", async ({ page }) => {
    await page.goto("/login");

    const username = page.getByTestId("input-login-username");
    await username.focus();
    await page.keyboard.type(users.alphaManager.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type("E2eSuiteAccess#2026");
    await page.keyboard.press("Enter");

    await page.waitForURL("**/dashboard", { timeout: 20_000 });
  });

  test("the active navigation item is announced to assistive technology", async ({ page }) => {
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);

    await page.goto("/customers");
    // aria-current is what tells a screen reader which page is open.
    await expect(page.locator('[aria-current="page"]').first()).toBeAttached({ timeout: 20_000 });
  });
});
