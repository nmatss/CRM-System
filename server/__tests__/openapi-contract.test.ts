import { beforeAll, describe, expect, it } from "vitest";
import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

/**
 * Contract parity gate (Fase 2 do plano de conclusão).
 *
 * The published router and `docs/openapi.yaml` must describe the same API.
 * This fails both ways: an undocumented route and a documented route that no
 * longer exists are equally a drift.
 */

const HTTP_METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);

/** Endpoints that exist for the browser/runtime, not as a public contract. */
const NOT_PART_OF_THE_CONTRACT = new Set<string>([]);

describe("OpenAPI contract parity", () => {
  let published: Array<{ path: string; method: string }>;
  let documented: Array<{ path: string; method: string }>;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_PATH = "./data/test-openapi.db";
    process.env.SESSION_DATABASE_PATH = "./data/test-openapi-sessions.db";
    process.env.SESSION_SECRET = "openapi-contract-test-secret-value-0123456789";

    const { registerRoutes } = await import("../routes");
    const { listPublishedOperations } = await import("../routeInventory");

    const app: Express = express();
    app.use(express.json());
    const httpServer: Server = createServer(app);
    await registerRoutes(httpServer, app);

    published = listPublishedOperations(app).filter(
      (operation) =>
        operation.path.startsWith("/api/") &&
        !NOT_PART_OF_THE_CONTRACT.has(`${operation.method} ${operation.path}`),
    );

    // The suite runs from a temporary working directory, so resolve from this file.
    const specPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/openapi.yaml");
    const spec = parse(readFileSync(specPath, "utf8")) as {
      paths?: Record<string, Record<string, unknown>>;
    };

    documented = Object.entries(spec.paths ?? {})
      .flatMap(([path, operations]) =>
        Object.keys(operations ?? {})
          .filter((key) => HTTP_METHODS.has(key.toLowerCase()))
          .map((method) => ({ path, method: method.toLowerCase() })),
      )
      .sort((a, b) =>
        a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path),
      );
  });

  it("finds the routes the application really publishes", () => {
    expect(published.length).toBeGreaterThan(50);
    expect(published).toContainEqual({ path: "/api/health", method: "get" });
    expect(published).toContainEqual({ path: "/api/v1/customers/{id}", method: "put" });
  });

  it("documents every published operation", () => {
    // Path templates are case-sensitive, so only the method is normalized.
    const documentedKeys = new Set(documented.map((op) => `${op.method} ${op.path}`));
    const undocumented = published
      .filter((op) => !documentedKeys.has(`${op.method} ${op.path}`))
      .map((op) => `${op.method.toUpperCase()} ${op.path}`);

    expect(undocumented).toEqual([]);
  });

  it("does not document an operation the application no longer publishes", () => {
    const publishedKeys = new Set(published.map((op) => `${op.method} ${op.path}`));
    const stale = documented
      .filter((op) => !publishedKeys.has(`${op.method} ${op.path}`))
      .map((op) => `${op.method.toUpperCase()} ${op.path}`);

    expect(stale).toEqual([]);
  });
});
