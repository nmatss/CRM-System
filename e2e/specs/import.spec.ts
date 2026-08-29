import { expect, test } from "@playwright/test";
import { users } from "../fixtures";
import { expectAuthenticatedShell, login, openApiSession } from "../helpers";

/**
 * Gate F3 in the browser: importing a spreadsheet must show what it will do
 * before it does it, and re-uploading the same file must not duplicate the base.
 */
test.describe("customer import", () => {
  test("the dialog previews the plan before anything is written", async ({ page }) => {
    const marker = Date.now();
    const csv = [
      "name,email,segment",
      `Importado Um ${marker},importado-um-${marker}@example.test,VIP`,
      `Importado Dois ${marker},importado-dois-${marker}@example.test,Novo`,
      "X,,",
    ].join("\n");

    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);
    await page.goto("/customers");

    await page.getByTestId("input-import-file").setInputFiles({
      name: "clientes.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });

    await expect(page.getByTestId("import-dialog")).toBeVisible({ timeout: 20_000 });

    // The plan is computed by the server without writing anything.
    const preview = page.getByTestId("import-preview");
    await expect(preview).toContainText(/2 clientes a criar/, { timeout: 20_000 });
    await expect(preview).toContainText(/1 com erro/);

    await page.getByTestId("button-confirm-import").click();
    await expect(page.getByText(/importação concluída/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("re-uploading the same file reports duplicates and creates nothing", async ({
    page,
    browser,
  }) => {
    const marker = Date.now();
    const email = `reimportado-${marker}@example.test`;
    const csv = ["name,email,segment", `Reimportado ${marker},${email},VIP`].join("\n");

    const manager = await openApiSession(browser, users.alphaManager.email);
    const first = await manager.send<{ totals: { created: number } }>(
      "POST",
      "/api/v1/import/customers",
      { rows: [{ name: `Reimportado ${marker}`, email, segment: "VIP" }], mode: "commit" },
    );
    expect(first.body.totals.created).toBe(1);
    await manager.close();

    await login(page, users.alphaManager.email);
    await expectAuthenticatedShell(page);
    await page.goto("/customers");

    await page.getByTestId("input-import-file").setInputFiles({
      name: "clientes.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf-8"),
    });

    await expect(page.getByTestId("import-preview")).toContainText(/a ignorar por duplicidade/, {
      timeout: 20_000,
    });
    // Committing would change nothing, so the action is disabled.
    await expect(page.getByTestId("button-confirm-import")).toBeDisabled();
  });

  test("a dry-run leaves the database untouched", async ({ browser }) => {
    const marker = Date.now();
    const email = `dry-run-${marker}@example.test`;
    const manager = await openApiSession(browser, users.alphaManager.email);

    const dry = await manager.send<{ mode: string; totals: { created: number } }>(
      "POST",
      "/api/v1/import/customers",
      { rows: [{ name: `Dry Run ${marker}`, email }], mode: "dry-run" },
    );
    expect(dry.body.mode).toBe("dry-run");
    expect(dry.body.totals.created).toBe(1);

    const list = await manager.get<{ data: Array<{ email: string }> }>(
      `/api/v1/customers?limit=100&search=dry-run-${marker}`,
    );
    expect(list.body.data.map((row) => row.email)).not.toContain(email);

    await manager.close();
  });

  test("an atomic import writes nothing when a row is invalid", async ({ browser }) => {
    const marker = Date.now();
    const manager = await openApiSession(browser, users.alphaManager.email);

    const response = await manager.send<{ totals: { invalid: number } }>(
      "POST",
      "/api/v1/import/customers",
      {
        rows: [
          { name: `Atomico Bom ${marker}`, email: `atomico-bom-${marker}@example.test` },
          { name: "X" },
        ],
        mode: "commit",
        atomic: true,
      },
    );

    // 409: the caller asked to be stopped rather than partially commit.
    expect(response.status).toBe(409);

    const list = await manager.get<{ data: Array<{ email: string }> }>(
      `/api/v1/customers?limit=100&search=atomico-bom-${marker}`,
    );
    expect(list.body.data).toHaveLength(0);

    await manager.close();
  });
});
