import { sqlite } from "../db";

/**
 * Tenant-scoped global search.
 *
 * The header carried a search box that did nothing: no handler, no request, no
 * result. This backs it with a real query, scoped to the active tenant like
 * every other read in the system.
 */

export const SEARCH_TYPES = ["customer", "product", "order"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export interface SearchHit {
  type: SearchType;
  id: number;
  title: string;
  subtitle: string | null;
  /** Where the UI should navigate. */
  href: string;
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  totals: Record<SearchType, number>;
  /** True when more rows matched than the response carries. */
  truncated: boolean;
}

/**
 * Escapes the LIKE wildcards so a user typing `%` searches for a percent sign
 * instead of matching every row in the tenant.
 */
export function toLikePattern(term: string): string {
  const escaped = term.replace(/[\\%_]/g, (match) => `\\${match}`);
  return `%${escaped}%`;
}

interface EntityQuery {
  type: SearchType;
  countSql: string;
  rowsSql: string;
  map: (row: Record<string, unknown>) => SearchHit;
}

const ENTITIES: EntityQuery[] = [
  {
    type: "customer",
    countSql: `SELECT COUNT(*) AS total FROM customers
                WHERE tenant_id = @tenantId
                  AND (name LIKE @pattern ESCAPE '\\' OR email LIKE @pattern ESCAPE '\\')`,
    rowsSql: `SELECT id, name, email, segment FROM customers
               WHERE tenant_id = @tenantId
                 AND (name LIKE @pattern ESCAPE '\\' OR email LIKE @pattern ESCAPE '\\')
               ORDER BY name COLLATE NOCASE ASC
               LIMIT @perType`,
    map: (row) => ({
      type: "customer",
      id: Number(row.id),
      title: String(row.name),
      subtitle: [row.email, row.segment].filter(Boolean).join(" · ") || null,
      href: "/customers",
    }),
  },
  {
    type: "product",
    countSql: `SELECT COUNT(*) AS total FROM products
                WHERE tenant_id = @tenantId
                  AND (name LIKE @pattern ESCAPE '\\' OR category LIKE @pattern ESCAPE '\\')`,
    rowsSql: `SELECT id, name, category, status FROM products
               WHERE tenant_id = @tenantId
                 AND (name LIKE @pattern ESCAPE '\\' OR category LIKE @pattern ESCAPE '\\')
               ORDER BY name COLLATE NOCASE ASC
               LIMIT @perType`,
    map: (row) => ({
      type: "product",
      id: Number(row.id),
      title: String(row.name),
      subtitle: [row.category, row.status].filter(Boolean).join(" · ") || null,
      href: "/products",
    }),
  },
  {
    type: "order",
    countSql: `SELECT COUNT(*) AS total FROM orders
                WHERE tenant_id = @tenantId
                  AND (order_id LIKE @pattern ESCAPE '\\' OR customer LIKE @pattern ESCAPE '\\')`,
    rowsSql: `SELECT id, order_id AS orderId, customer, status FROM orders
               WHERE tenant_id = @tenantId
                 AND (order_id LIKE @pattern ESCAPE '\\' OR customer LIKE @pattern ESCAPE '\\')
               ORDER BY order_date DESC, id DESC
               LIMIT @perType`,
    map: (row) => ({
      type: "order",
      id: Number(row.id),
      title: String(row.orderId),
      subtitle: [row.customer, row.status].filter(Boolean).join(" · ") || null,
      href: "/orders",
    }),
  },
];

/**
 * Runs the search inside one tenant. `perType` caps how many rows of each kind
 * come back, so a broad term cannot return the whole database.
 */
export function searchTenant(tenantId: number, term: string, perType = 5): SearchResult {
  const query = term.trim();
  const empty: SearchResult = {
    query,
    hits: [],
    totals: { customer: 0, product: 0, order: 0 },
    truncated: false,
  };
  if (query.length < 2) return empty;

  const params = { tenantId, pattern: toLikePattern(query), perType };
  const hits: SearchHit[] = [];
  const totals: Record<SearchType, number> = { customer: 0, product: 0, order: 0 };

  for (const entity of ENTITIES) {
    totals[entity.type] = (sqlite.prepare(entity.countSql).get(params) as { total: number }).total;
    const rows = sqlite.prepare(entity.rowsSql).all(params) as Array<Record<string, unknown>>;
    for (const row of rows) hits.push(entity.map(row));
  }

  const matched = totals.customer + totals.product + totals.order;
  return { query, hits, totals, truncated: matched > hits.length };
}
