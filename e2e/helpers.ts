import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { E2E_BASE_URL, E2E_PASSWORD } from "./fixtures";

/**
 * The session cookie is `Secure`, exactly as in production behind a
 * TLS-terminating proxy. Playwright's standalone `APIRequestContext` refuses to
 * send such a cookie over plain HTTP, so every API call in this suite goes
 * through the page's own `fetch`. That is also the most faithful path: it is
 * literally what the application's client does.
 */

export interface ApiResponse<T = unknown> {
  status: number;
  ok: boolean;
  body: T;
}

async function pageFetch<T>(
  page: Page,
  method: string,
  path: string,
  options: { data?: unknown; csrfToken?: string } = {},
): Promise<ApiResponse<T>> {
  return (await page.evaluate(
    async ({ method, path, data, csrfToken }) => {
      const headers: Record<string, string> = {};
      if (data !== undefined) headers["Content-Type"] = "application/json";
      if (csrfToken) headers["x-csrf-token"] = csrfToken;

      const response = await fetch(path, {
        method,
        headers,
        credentials: "include",
        body: data === undefined ? undefined : JSON.stringify(data),
      });

      const text = await response.text();
      let parsed: unknown = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        // Keep the raw text so a spec expecting JSON fails with the real body.
      }
      return { status: response.status, ok: response.ok, body: parsed };
    },
    { method, path, data: options.data, csrfToken: options.csrfToken },
  )) as ApiResponse<T>;
}

/** An authenticated API session bound to a real browser context. */
export class ApiSession {
  constructor(
    readonly page: Page,
    public token: string,
    private readonly context?: BrowserContext,
  ) {}

  get<T>(path: string) {
    return pageFetch<T>(this.page, "GET", path);
  }

  send<T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, data?: unknown) {
    return pageFetch<T>(this.page, method, path, { data: data ?? {}, csrfToken: this.token });
  }

  /** Sends a state change deliberately without the CSRF header. */
  sendWithoutCsrf<T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, data?: unknown) {
    return pageFetch<T>(this.page, method, path, { data: data ?? {} });
  }

  async close() {
    await this.context?.close();
  }
}

export async function fetchCsrfToken(page: Page): Promise<string> {
  const response = await pageFetch<{ csrfToken?: string }>(page, "GET", "/api/v1/csrf-token");
  expect(response.status, "CSRF endpoint must accept the session").toBe(200);
  expect(response.body.csrfToken, "CSRF endpoint must return a token").toBeTruthy();
  return response.body.csrfToken as string;
}

/** Signs in through the real form and waits for the authenticated landing page. */
export async function login(page: Page, email: string, expectedPath = "/dashboard") {
  await page.goto("/login");
  await page.getByTestId("input-login-username").fill(email);
  await page.getByTestId("input-login-password").fill(E2E_PASSWORD);
  await page.getByTestId("button-login").click();
  await page.waitForURL(`**${expectedPath}`, { timeout: 20_000 });
}

/**
 * Signs out and waits for the app shell to disappear. The exact landing URL is
 * deliberately not asserted: an unauthenticated visitor is sent to the public
 * landing page, and the security-relevant fact is that the shell is gone.
 */
export async function logout(page: Page) {
  await page.getByTestId("button-sidebar-logout").click();
  await expect(page.getByTestId("button-sidebar-logout")).toHaveCount(0, { timeout: 20_000 });
}

/** Authenticates without the UI, for specs that only exercise the API. */
export async function apiLogin(page: Page, email: string) {
  await page.goto("/login");
  const response = await pageFetch(page, "POST", "/api/v1/auth/login", {
    data: { username: email, password: E2E_PASSWORD },
  });
  expect(response.status, `login for ${email}`).toBe(200);
}

/**
 * Opens an independent authenticated session. Specs that need two identities at
 * the same time use one of these per identity, so neither invalidates the other.
 */
export async function openApiSession(browser: Browser, email: string): Promise<ApiSession> {
  const context = await browser.newContext({
    baseURL: E2E_BASE_URL,
    extraHTTPHeaders: { "X-Forwarded-Proto": "https" },
  });
  const page = await context.newPage();
  await apiLogin(page, email);
  const token = await fetchCsrfToken(page);
  return new ApiSession(page, token, context);
}

/** Binds an API session to a page that already signed in through the UI. */
export async function apiForPage(page: Page): Promise<ApiSession> {
  return new ApiSession(page, await fetchCsrfToken(page));
}

/** Waits for the app shell to be interactive on any authenticated page. */
export async function expectAuthenticatedShell(page: Page) {
  await expect(page.getByTestId("button-sidebar-logout")).toBeAttached({ timeout: 20_000 });
}
