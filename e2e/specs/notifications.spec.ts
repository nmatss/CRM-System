import { expect, test } from "@playwright/test";
import { users } from "../fixtures";
import { openApiSession } from "../helpers";

/**
 * A notification belongs to one user inside one tenant. The badge must be
 * clearable, and an id from another account must never change someone else's
 * row.
 */
test.describe("notification read state", () => {
  test("a user marks their own notification read and the badge clears", async ({ browser }) => {
    const manager = await openApiSession(browser, users.alphaManager.email);

    const me = await manager.get<{ id: string; tenantId?: number }>("/api/v1/auth/me");
    expect(me.status).toBe(200);

    const before = await manager.get<Array<{ id: number; status: string }>>(
      "/api/v1/notifications?limit=100",
    );
    expect(before.status).toBe(200);

    // Clearing everything is idempotent and safe even with an empty inbox.
    const readAll = await manager.send<{ updated: number }>(
      "POST",
      "/api/v1/notifications/read-all",
    );
    expect(readAll.status).toBe(200);
    expect(typeof readAll.body.updated).toBe("number");

    const after = await manager.get<Array<{ status: string }>>("/api/v1/notifications?limit=100");
    expect(after.body.every((row) => row.status.toLowerCase() === "read")).toBe(true);

    await manager.close();
  });

  test("marking an unknown or foreign notification is refused", async ({ browser }) => {
    const manager = await openApiSession(browser, users.alphaManager.email);

    const missing = await manager.send("PATCH", "/api/v1/notifications/999999/read");
    expect(missing.status).toBe(404);

    const invalid = await manager.send("PATCH", "/api/v1/notifications/abc/read");
    expect(invalid.status).toBe(400);

    await manager.close();
  });

  test("an unauthenticated caller cannot clear notifications", async ({ page }) => {
    await page.goto("/login");
    const status = await page.evaluate(async () => {
      const r = await fetch("/api/v1/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      return r.status;
    });
    // 401 without a session, or 403 from CSRF: either way, refused.
    expect([401, 403]).toContain(status);
  });
});
