import { beforeEach, describe, expect, it } from "vitest";
import { recordHttpSample, renderMetrics, resetMetrics, resolveRouteLabel } from "../metrics";
import type { Request } from "express";

const snapshot = {
  outboxBacklog: { pending: 2, processing: 1, retryWait: 3, deadLetter: 0 },
  databaseConnected: true,
};

describe("metrics exposition", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("labels a request by its route pattern, never by the raw URL", () => {
    const request = {
      route: { path: "/customers/:id" },
      baseUrl: "/api/v1",
    } as unknown as Request;

    // A per-id label would create one time series per customer.
    expect(resolveRouteLabel(request)).toBe("/api/v1/customers/:id");
    expect(resolveRouteLabel({ baseUrl: "" } as unknown as Request)).toBe("unmatched");
  });

  it("counts responses by status class and accumulates the latency histogram", () => {
    recordHttpSample("/api/v1/customers", 200, 12);
    recordHttpSample("/api/v1/customers", 200, 300);
    recordHttpSample("/api/v1/customers", 500, 8);

    const output = renderMetrics(snapshot);

    expect(output).toContain(
      'zippcrm_http_requests_total{route="/api/v1/customers",status="2xx"} 2',
    );
    expect(output).toContain(
      'zippcrm_http_requests_total{route="/api/v1/customers",status="5xx"} 1',
    );
    expect(output).toContain(
      'zippcrm_http_request_duration_ms_bucket{route="/api/v1/customers",le="10"} 1',
    );
    expect(output).toContain(
      'zippcrm_http_request_duration_ms_bucket{route="/api/v1/customers",le="25"} 2',
    );
    expect(output).toContain(
      'zippcrm_http_request_duration_ms_bucket{route="/api/v1/customers",le="+Inf"} 3',
    );
    expect(output).toContain('zippcrm_http_request_duration_ms_count{route="/api/v1/customers"} 3');
  });

  it("caps the number of tracked routes and reports what it dropped", () => {
    for (let i = 0; i < 250; i += 1) {
      recordHttpSample(`/route-${i}`, 200, 5);
    }

    const output = renderMetrics(snapshot);
    const trackedRoutes = output
      .split("\n")
      .filter((line) => line.startsWith("zippcrm_http_requests_total{")).length;

    expect(trackedRoutes).toBe(200);
    expect(output).toContain("zippcrm_http_route_samples_dropped_total 50");
  });

  it("exposes build identity, database state and the outbox backlog", () => {
    const output = renderMetrics(snapshot);

    expect(output).toMatch(
      /zippcrm_build_info\{version="[^"]+",commit="[^"]+",built_at="[^"]*"\} 1/,
    );
    expect(output).toContain("zippcrm_database_up 1");
    expect(output).toContain('zippcrm_outbox_jobs{state="pending"} 2');
    expect(output).toContain('zippcrm_outbox_jobs{state="dead_letter"} 0');
    expect(renderMetrics({ ...snapshot, databaseConnected: false })).toContain(
      "zippcrm_database_up 0",
    );
  });

  it("escapes label values so a crafted route cannot break the format", () => {
    recordHttpSample('/api/"weird"\n', 200, 5);
    const output = renderMetrics(snapshot);
    expect(output).toContain('route="/api/\\"weird\\"\\n"');
  });
});
