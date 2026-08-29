import { describe, expect, it } from "vitest";
import { preservePaginatedResponse, unwrapList } from "./apiResponses";
import { normalizeApiUrl } from "./queryClient";

describe("normalizeApiUrl", () => {
  it("keeps canonical v1 and health endpoints unchanged", () => {
    expect(normalizeApiUrl("/api/v1/customers")).toBe("/api/v1/customers");
    expect(normalizeApiUrl("/api/health")).toBe("/api/health");
  });

  it("upgrades legacy /api paths to /api/v1", () => {
    expect(normalizeApiUrl("/api/customers")).toBe("/api/v1/customers");
    expect(normalizeApiUrl("/api/seller-tasks?status=pending")).toBe(
      "/api/v1/seller-tasks?status=pending",
    );
  });

  it("prefixes short API paths", () => {
    expect(normalizeApiUrl("/customers")).toBe("/api/v1/customers");
    expect(normalizeApiUrl("auth/me")).toBe("/api/v1/auth/me");
  });
});

describe("unwrapList", () => {
  it("keeps legacy array payloads compatible", () => {
    expect(unwrapList([{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("unwraps paginated API payloads", () => {
    expect(unwrapList({ data: [{ id: 1 }], pagination: { page: 1, total: 1 } })).toEqual([
      { id: 1 },
    ]);
  });

  it("returns an empty list for malformed payloads", () => {
    expect(unwrapList(null)).toEqual([]);
    expect(unwrapList({ data: undefined } as any)).toEqual([]);
  });
});

describe("preservePaginatedResponse", () => {
  it("preserves pagination metadata from the API", () => {
    expect(
      preservePaginatedResponse(
        { data: [{ id: 1 }], pagination: { page: 2, limit: 20, total: 45, totalPages: 3 } },
        { page: 1, limit: 10 },
      ),
    ).toEqual({
      data: [{ id: 1 }],
      pagination: { page: 2, limit: 20, total: 45, totalPages: 3 },
    });
  });

  it("creates metadata for legacy array responses", () => {
    expect(preservePaginatedResponse([{ id: 1 }, { id: 2 }], { page: 1, limit: 20 })).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
  });
});
