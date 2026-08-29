import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPaginatedQuery } from "./paginatedQuery";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPaginatedQuery", () => {
  it("sends pagination, search, filters and sorting to the server", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 21 }],
        pagination: { page: 2, limit: 20, total: 45, totalPages: 3 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPaginatedQuery<{ id: number }>({
      endpoint: "/api/v1/products",
      page: 2,
      limit: 20,
      filters: { search: "camisa", status: "Ativo", sort: "name", order: "asc" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/products?page=2&limit=20&search=camisa&status=Ativo&sort=name&order=asc",
    );
    expect(result.pagination).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
  });

  it("omits empty optional filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await fetchPaginatedQuery({
      endpoint: "/api/v1/customers",
      page: 1,
      limit: 20,
      filters: { search: undefined },
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/customers?page=1&limit=20");
  });
});
