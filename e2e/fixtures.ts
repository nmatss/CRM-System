/**
 * Shared identities and constants for the end-to-end suite.
 *
 * These credentials only ever exist in the disposable database created by
 * `e2e/scripts/seed-e2e.ts`; they are never valid anywhere else.
 */

export const E2E_PORT = Number(process.env.E2E_PORT ?? 5273);
/** The harness terminates TLS, exactly as production does. */
export const E2E_BASE_URL = `https://127.0.0.1:${E2E_PORT}`;

export const E2E_PASSWORD = "E2eSuiteAccess#2026";

export const users = {
  superAdmin: { email: "e2e-super@example.test", name: "E2E Super Admin" },
  alphaManager: { email: "e2e-alpha-manager@example.test", name: "E2E Alpha Manager" },
  alphaSeller: { email: "e2e-alpha-seller@example.test", name: "E2E Alpha Seller" },
  betaManager: { email: "e2e-beta-manager@example.test", name: "E2E Beta Manager" },
} as const;

export const tenants = {
  alpha: { slug: "e2e-alpha", name: "E2E Alpha" },
  beta: { slug: "e2e-beta", name: "E2E Beta" },
} as const;

/** Fixture rows the specs assert against. */
export const seededData = {
  alphaCustomerName: "Cliente Alpha E2E",
  alphaVipCustomerName: "Cliente VIP Alpha E2E",
  betaCustomerName: "Cliente Beta E2E",
  alphaProductName: "Produto Alpha E2E",
  alphaCampaignName: "Campanha Alpha E2E",
  alphaAutomationTitle: "Automacao Alpha E2E",
} as const;

/** Breakpoints the responsive checks must cover. */
export const breakpoints = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "desktop", width: 1920, height: 1080 },
] as const;
