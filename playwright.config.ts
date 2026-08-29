import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { E2E_BASE_URL, E2E_PORT } from "./e2e/fixtures";

/**
 * End-to-end configuration (Fase 7 do plano de conclusão).
 *
 * The suite runs against the real production build served by the real server,
 * on a disposable SQLite database that is recreated on every run. Nothing here
 * ever points at a shared or production database.
 */

const PORT = E2E_PORT;
const BASE_URL = E2E_BASE_URL;
const DATA_DIR = process.env.E2E_DATA_DIR ?? mkdtempSync(join(tmpdir(), "zippcrm-e2e-"));

export default defineConfig({
  testDir: "./e2e/specs",
  outputDir: "./output/playwright/results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // The server is a single process writing one SQLite file, so the suite runs
  // serially instead of racing itself for the same rows.
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "./output/playwright/report", open: "never" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "pt-BR",
    timezoneId: "UTC",
    // Production terminates TLS in a proxy and the session cookie is `Secure`.
    // Declaring the forwarded protocol reproduces that exact configuration, so
    // the suite exercises the real production cookie path instead of a relaxed
    // one. Chrome accepts `Secure` cookies from 127.0.0.1 because it is a
    // trustworthy origin.
    extraHTTPHeaders: { "X-Forwarded-Proto": "https" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bash e2e/scripts/start-test-server.sh",
    url: `${BASE_URL}/api/ready`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NODE_ENV: "production",
      PORT: String(PORT),
      E2E_DATA_DIR: DATA_DIR,
      DATABASE_PATH: join(DATA_DIR, "e2e.db"),
      SESSION_DATABASE_PATH: join(DATA_DIR, "e2e-sessions.db"),
      SESSION_SECRET: "e2e-only-session-key-Qz7Kx2Lm9Rv4Tn8Bw1Yd6Hc3Jf5Gp0",
      TRUST_PROXY: "1",
      // The production bootstrap requires these; the suite signs in with its
      // own seeded identities instead of this account.
      ADMIN_EMAIL: "e2e-bootstrap@example.test",
      ADMIN_PASSWORD: "Qz7Kx2Lm9Rv4Tn8Bw1Yd",
      ALLOW_EMPTY_DATABASE_BOOTSTRAP: "true",
      // A browser suite issues far more than 100 requests per minute from one
      // address; the production default stays untouched.
      GENERAL_RATE_LIMIT_MAX: "100000",
      // Jobs are driven explicitly by the specs so assertions stay deterministic.
      OUTBOX_WORKER_ENABLED: "false",
    },
  },
});
