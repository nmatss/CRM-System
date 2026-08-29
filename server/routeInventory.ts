import type { Express } from "express";

/**
 * Runtime inventory of the routes the application actually publishes.
 *
 * The contract test compares this against `docs/openapi.yaml`, so the
 * specification cannot silently drift away from the router. Reading the live
 * Express stack (instead of parsing source) means a route only counts as
 * published when it is really mounted.
 */

export interface PublishedOperation {
  /** OpenAPI-style path, e.g. `/api/v1/customers/{id}`. */
  path: string;
  /** Lowercase HTTP method. */
  method: string;
}

interface ExpressLayer {
  name?: string;
  regexp?: RegExp & { fast_slash?: boolean };
  handle?: { stack?: ExpressLayer[] };
  route?: { path?: string | string[]; methods?: Record<string, boolean> };
}

/**
 * Recovers the mount prefix of a nested router from the regexp Express builds
 * for it (for example `/^\/api\/v1\/?(?=\/|$)/i` becomes `/api/v1`).
 */
function decodeMountPrefix(layer: ExpressLayer): string {
  if (!layer.regexp || layer.regexp.fast_slash) return "";
  const source = layer.regexp.source;
  const match = /^\^(.*?)\\\/\?\(\?=\\\/\|\$\)$/.exec(source);
  if (!match) return "";
  return match[1].replace(/\\\//g, "/");
}

/** Express `:id` becomes OpenAPI `{id}`. */
export function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function collect(
  stack: ExpressLayer[] | undefined,
  prefix: string,
  found: PublishedOperation[],
): void {
  for (const layer of stack ?? []) {
    if (layer.route) {
      const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path ?? "/"];
      for (const routePath of paths) {
        for (const [method, enabled] of Object.entries(layer.route.methods ?? {})) {
          // Express adds an implicit HEAD for every GET; it is not a contract.
          if (!enabled || method === "_all" || method === "head") continue;
          const full = `${prefix}${routePath}`.replace(/\/{2,}/g, "/");
          found.push({ path: toOpenApiPath(full), method: method.toLowerCase() });
        }
      }
      continue;
    }

    if (layer.handle?.stack) {
      collect(layer.handle.stack, `${prefix}${decodeMountPrefix(layer)}`, found);
    }
  }
}

/** Every HTTP operation the app publishes, sorted and de-duplicated. */
export function listPublishedOperations(app: Express): PublishedOperation[] {
  const found: PublishedOperation[] = [];
  const router = app as unknown as {
    _router?: { stack?: ExpressLayer[] };
    router?: { stack?: ExpressLayer[] };
  };
  collect(router._router?.stack ?? router.router?.stack, "", found);

  const unique = new Map<string, PublishedOperation>();
  for (const operation of found) {
    unique.set(`${operation.method} ${operation.path}`, operation);
  }

  return Array.from(unique.values()).sort((a, b) =>
    a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path),
  );
}
