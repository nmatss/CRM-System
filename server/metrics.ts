import type { Request, Response, NextFunction } from "express";
import { buildInfo } from "./buildInfo";

/**
 * In-process metrics in the Prometheus text format (Fase 9 do plano).
 *
 * Deliberately dependency-free: the deployment target is a single Node process
 * with an embedded worker, and the signals an operator needs to alert on are
 * request rate, error rate, latency and outbox backlog. Anything richer belongs
 * to a real metrics backend, which this endpoint can feed.
 *
 * Cardinality is the failure mode of naive HTTP metrics, so the route label is
 * the matched Express route pattern, never the raw URL, and it is capped.
 */

const LATENCY_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] as const;
const MAX_TRACKED_ROUTES = 200;

interface RouteMetrics {
  countByStatusClass: Map<string, number>;
  latencyBuckets: number[];
  latencySumMs: number;
  latencyCount: number;
}

const routes = new Map<string, RouteMetrics>();
let droppedRouteSamples = 0;
const startedAt = Date.now();

function emptyRouteMetrics(): RouteMetrics {
  return {
    countByStatusClass: new Map(),
    latencyBuckets: new Array(LATENCY_BUCKETS_MS.length + 1).fill(0),
    latencySumMs: 0,
    latencyCount: 0,
  };
}

/**
 * Uses the matched route pattern (`/customers/:id`) so a million distinct ids
 * cannot become a million time series.
 */
export function resolveRouteLabel(req: Request): string {
  const routePath = (req.route as { path?: string } | undefined)?.path;
  const base = req.baseUrl || "";
  if (typeof routePath === "string" && routePath.length > 0) {
    return `${base}${routePath}`.replace(/\/{2,}/g, "/") || "/";
  }
  // Unmatched requests share one series; the raw path would be attacker-controlled.
  return "unmatched";
}

export function recordHttpSample(route: string, statusCode: number, durationMs: number): void {
  let metrics = routes.get(route);
  if (!metrics) {
    if (routes.size >= MAX_TRACKED_ROUTES) {
      droppedRouteSamples += 1;
      return;
    }
    metrics = emptyRouteMetrics();
    routes.set(route, metrics);
  }

  const statusClass = `${Math.floor(statusCode / 100)}xx`;
  metrics.countByStatusClass.set(
    statusClass,
    (metrics.countByStatusClass.get(statusClass) ?? 0) + 1,
  );

  let bucketIndex = LATENCY_BUCKETS_MS.findIndex((limit) => durationMs <= limit);
  if (bucketIndex === -1) bucketIndex = LATENCY_BUCKETS_MS.length;
  for (let i = bucketIndex; i < metrics.latencyBuckets.length; i += 1) {
    metrics.latencyBuckets[i] += 1;
  }
  metrics.latencySumMs += durationMs;
  metrics.latencyCount += 1;
}

/** Records every API request; mounted before the routers. */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api")) return next();

  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    recordHttpSample(resolveRouteLabel(req), res.statusCode, durationMs);
  });
  next();
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export interface MetricsSnapshotInput {
  outboxBacklog: {
    pending: number;
    processing: number;
    retryWait: number;
    deadLetter: number;
  };
  databaseConnected: boolean;
}

/** Renders the Prometheus exposition format. */
export function renderMetrics(input: MetricsSnapshotInput): string {
  const lines: string[] = [];

  lines.push("# HELP zippcrm_build_info Build identity of the running process.");
  lines.push("# TYPE zippcrm_build_info gauge");
  lines.push(
    `zippcrm_build_info{version="${escapeLabel(buildInfo.version)}",commit="${escapeLabel(
      buildInfo.commit,
    )}",built_at="${escapeLabel(buildInfo.builtAt)}"} 1`,
  );

  lines.push("# HELP zippcrm_process_uptime_seconds Seconds since the process started.");
  lines.push("# TYPE zippcrm_process_uptime_seconds gauge");
  lines.push(`zippcrm_process_uptime_seconds ${((Date.now() - startedAt) / 1000).toFixed(0)}`);

  lines.push("# HELP zippcrm_database_up Whether the database answered the last readiness probe.");
  lines.push("# TYPE zippcrm_database_up gauge");
  lines.push(`zippcrm_database_up ${input.databaseConnected ? 1 : 0}`);

  lines.push("# HELP zippcrm_http_requests_total API responses by route and status class.");
  lines.push("# TYPE zippcrm_http_requests_total counter");
  for (const [route, metrics] of Array.from(routes.entries())) {
    for (const [statusClass, count] of Array.from(metrics.countByStatusClass.entries())) {
      lines.push(
        `zippcrm_http_requests_total{route="${escapeLabel(route)}",status="${statusClass}"} ${count}`,
      );
    }
  }

  lines.push("# HELP zippcrm_http_request_duration_ms Request latency histogram in milliseconds.");
  lines.push("# TYPE zippcrm_http_request_duration_ms histogram");
  for (const [route, metrics] of Array.from(routes.entries())) {
    const label = escapeLabel(route);
    LATENCY_BUCKETS_MS.forEach((limit, index) => {
      lines.push(
        `zippcrm_http_request_duration_ms_bucket{route="${label}",le="${limit}"} ${metrics.latencyBuckets[index]}`,
      );
    });
    lines.push(
      `zippcrm_http_request_duration_ms_bucket{route="${label}",le="+Inf"} ${metrics.latencyCount}`,
    );
    lines.push(
      `zippcrm_http_request_duration_ms_sum{route="${label}"} ${metrics.latencySumMs.toFixed(3)}`,
    );
    lines.push(`zippcrm_http_request_duration_ms_count{route="${label}"} ${metrics.latencyCount}`);
  }

  lines.push("# HELP zippcrm_http_route_samples_dropped_total Samples dropped by the route cap.");
  lines.push("# TYPE zippcrm_http_route_samples_dropped_total counter");
  lines.push(`zippcrm_http_route_samples_dropped_total ${droppedRouteSamples}`);

  lines.push("# HELP zippcrm_outbox_jobs Outbox jobs by state.");
  lines.push("# TYPE zippcrm_outbox_jobs gauge");
  lines.push(`zippcrm_outbox_jobs{state="pending"} ${input.outboxBacklog.pending}`);
  lines.push(`zippcrm_outbox_jobs{state="processing"} ${input.outboxBacklog.processing}`);
  lines.push(`zippcrm_outbox_jobs{state="retry_wait"} ${input.outboxBacklog.retryWait}`);
  lines.push(`zippcrm_outbox_jobs{state="dead_letter"} ${input.outboxBacklog.deadLetter}`);

  return `${lines.join("\n")}\n`;
}

/** Test seam: clears the accumulated series. */
export function resetMetrics(): void {
  routes.clear();
  droppedRouteSamples = 0;
}
