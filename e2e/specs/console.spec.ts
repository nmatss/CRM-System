import { expect, test, type ConsoleMessage } from "@playwright/test";
import { users } from "../fixtures";
import { expectAuthenticatedShell, login } from "../helpers";

/**
 * Go-live gate: the main screens must load without console errors or failed
 * requests. A page that renders while throwing is a defect the visual checks
 * do not catch.
 */

/** Noise that is not produced by the application itself. */
const IGNORED = [
  /favicon/i,
  /Download the React DevTools/i,
  // A page navigated away mid-request is not an application error.
  /net::ERR_ABORTED/i,
];

function isRelevant(text: string): boolean {
  return !IGNORED.some((pattern) => pattern.test(text));
}

test("the main screens load without console errors or failed requests", async ({ page }) => {
  test.slow();

  const problems: string[] = [];

  // The browser logs a console error for any non-2xx resource, including the
  // deliberate 401 that the app uses to discover it is not signed in. Only
  // failures observed after login are application defects, so listeners are
  // attached once the session exists.
  const listen = () => {
    page.on("console", (message: ConsoleMessage) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (isRelevant(text)) problems.push(`console: ${text}`);
    });
    page.on("pageerror", (error) => {
      problems.push(`pageerror: ${error.message}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        problems.push(`http ${response.status()}: ${response.url()}`);
      }
    });
  };
  await login(page, users.alphaManager.email);
  await expectAuthenticatedShell(page);
  listen();

  for (const path of [
    "/dashboard",
    "/customers",
    "/products",
    "/orders",
    "/cashback",
    "/campaigns",
    "/automations",
    "/reports",
    "/agenda",
    "/settings",
  ]) {
    await page.goto(path);
    await expectAuthenticatedShell(page);
    await page.waitForTimeout(500);
  }

  expect(problems.join("\n")).toBe("");
});
