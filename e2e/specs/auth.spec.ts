import { expect, test } from "@playwright/test";
import { E2E_PASSWORD, users } from "../fixtures";
import { expectAuthenticatedShell, login, logout } from "../helpers";

/**
 * Gate F7: the authentication flow must work end to end in a real browser for
 * every role, and a logged-out session must lose access immediately.
 */
test.describe("authentication", () => {
  test("a manager signs in, reaches the dashboard and signs out", async ({ page }) => {
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await logout(page);

    // The protected route must not render after logout. The app sends an
    // unauthenticated visitor to the public landing page.
    await page.goto("/customers");
    await expect(page.getByTestId("button-sidebar-logout")).toHaveCount(0);
    await expect(page.getByTestId("input-search-customers")).toHaveCount(0);
  });

  test("a seller signs in and lands on the dashboard", async ({ page }) => {
    await login(page, users.alphaSeller.email);
    await expectAuthenticatedShell(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("a super admin lands on the administration panel", async ({ page }) => {
    await login(page, users.superAdmin.email, "/admin");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("wrong credentials are refused without revealing which field failed", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("input-login-username").fill(users.alphaManager.email);
    await page.getByTestId("input-login-password").fill(`${E2E_PASSWORD}-wrong`);
    await page.getByTestId("button-login").click();

    await expect(page).toHaveURL(/\/login$/);
    // The message must not distinguish an unknown user from a wrong password.
    await expect(page.getByText(/inválid/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("an unauthenticated visitor cannot reach a protected route", async ({ page }) => {
    await page.goto("/reports");

    // The report screen must not render; the visitor lands on the public page.
    await expect(page.getByTestId("button-sidebar-logout")).toHaveCount(0);
    await expect(page.getByTestId("badge-hero")).toBeVisible({ timeout: 20_000 });
  });
});
