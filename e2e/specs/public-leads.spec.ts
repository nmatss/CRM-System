import { expect, test } from "@playwright/test";
import { users } from "../fixtures";
import { openApiSession } from "../helpers";

/**
 * The landing forms are the only unauthenticated writes that persist personal
 * data. These cases prove, in a real browser, that consent is required and
 * recorded, and that the server refuses everything the contract closes off.
 */
test.describe("public lead capture", () => {
  test("the contact form requires an explicit consent before it can be submitted", async ({
    page,
  }) => {
    await page.goto("/landing");

    await page.getByTestId("button-header-contact").first().click();
    await expect(page.getByTestId("input-contact-name")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("input-contact-name").fill("Visitante E2E");
    await page.getByTestId("input-contact-email").fill(`visitante-${Date.now()}@example.test`);
    await page.getByTestId("input-contact-message").fill("Gostaria de conhecer o produto.");

    // Without consent the submit control stays disabled.
    await expect(page.getByTestId("button-submit-contact")).toBeDisabled();

    await page.getByTestId("input-contact-consent").check();
    await expect(page.getByTestId("button-submit-contact")).toBeEnabled();

    await page.getByTestId("button-submit-contact").click();
    await expect(page.getByText(/mensagem enviada/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("the server refuses a submission without consent", async ({ page }) => {
    await page.goto("/landing");

    const response = await page.evaluate(async () => {
      const r = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Sem Consentimento",
          email: "sem-consentimento@example.test",
          message: "mensagem de teste",
        }),
      });
      return { status: r.status, body: await r.json() };
    });

    expect(response.status).toBe(400);
  });

  test("the server refuses a caller-supplied triage status", async ({ page }) => {
    await page.goto("/landing");

    const response = await page.evaluate(async () => {
      const r = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Status Forjado",
          email: "status-forjado@example.test",
          message: "mensagem de teste",
          consent: true,
          status: "converted",
        }),
      });
      return r.status;
    });

    expect(response).toBe(400);
  });

  test("a filled honeypot is discarded without persisting anything", async ({ page, browser }) => {
    const marker = `honeypot-${Date.now()}@example.test`;

    await page.goto("/landing");
    const status = await page.evaluate(async (email) => {
      const r = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Bot",
          email,
          message: "spam spam spam",
          consent: true,
          website: "http://spam.example",
        }),
      });
      return r.status;
    }, marker);

    // The bot is told it succeeded so it learns nothing about the control.
    expect(status).toBe(201);

    // But nothing was stored.
    const admin = await openApiSession(browser, users.superAdmin.email);
    const contacts = await admin.get<Array<{ email: string }>>("/api/v1/admin/contacts");
    expect(contacts.body.map((row) => row.email)).not.toContain(marker);
    await admin.close();
  });

  test("an accepted lead is stored with the consent that legitimises it", async ({
    page,
    browser,
  }) => {
    const email = `consentido-${Date.now()}@example.test`;

    await page.goto("/landing");
    const status = await page.evaluate(async (address) => {
      const r = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Lead Consentido",
          email: address,
          message: "quero saber mais sobre o produto",
          consent: true,
        }),
      });
      return r.status;
    }, email);
    expect(status).toBe(201);

    const admin = await openApiSession(browser, users.superAdmin.email);
    const contacts =
      await admin.get<Array<{ email: string; status: string; consentAcceptedAt: string | null }>>(
        "/api/v1/admin/contacts",
      );
    const stored = contacts.body.find((row) => row.email === email);

    expect(stored, "the lead must have been stored").toBeTruthy();
    // The server owns the triage state and records the consent.
    expect(stored!.status).toBe("pending");
    expect(stored!.consentAcceptedAt).toBeTruthy();

    await admin.close();
  });
});
