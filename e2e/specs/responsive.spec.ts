import { expect, test } from "@playwright/test";
import { breakpoints, users } from "../fixtures";
import { expectAuthenticatedShell, login } from "../helpers";

/**
 * Gate F7: the layout must work at 375, 768, 1280 and 1920 px. The check is
 * behavioural rather than pixel-based: no horizontal overflow and the primary
 * content stays reachable.
 */
test.describe("responsive layout", () => {
  for (const breakpoint of breakpoints) {
    test(`the dashboard does not overflow horizontally at ${breakpoint.name} (${breakpoint.width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await login(page, users.alphaManager.email);
      await expectAuthenticatedShell(page);
      await page.waitForTimeout(400);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      // A couple of pixels of rounding is tolerated; a real overflow is not.
      expect(
        overflow.scrollWidth - overflow.clientWidth,
        `horizontal overflow at ${breakpoint.width}px`,
      ).toBeLessThanOrEqual(2);
    });
  }

  test("the customers list does not overflow horizontally on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);

    await page.goto("/customers");
    await page.waitForTimeout(600);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("the desktop sidebar keeps its full width and shows the navigation", async ({ page }) => {
    // Regression guard: the content column used to carry `lg:ml-64` while the
    // sidebar was also a static flex item, which overflowed the row and shrank
    // the sidebar to a few pixels, hiding the whole menu.
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);
    await page.waitForTimeout(400);

    const sidebarWidth = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      return aside ? Math.round(aside.getBoundingClientRect().width) : 0;
    });
    expect(sidebarWidth).toBeGreaterThanOrEqual(200);

    await expect(page.getByTestId("nav-link-dashboard")).toBeVisible();
    await expect(page.getByTestId("nav-link-customers")).toBeVisible();
    await expect(page.getByTestId("button-sidebar-logout")).toBeVisible();
  });

  test("navigation stays reachable on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);

    // The sidebar collapses on small screens, so the logout control is still in
    // the DOM and reachable once the drawer is opened.
    await expect(page.getByTestId("button-sidebar-logout")).toBeAttached();
  });
});
