import { preservePaginatedResponse, type PaginatedResponse } from "./apiResponses";

interface PaginatedQueryOptions {
  endpoint: string;
  page: number;
  limit: number;
  filters?: Record<string, string | undefined>;
}

function buildUrl(
  endpoint: string,
  page: number,
  limit: number,
  filters: Record<string, string | undefined> = {},
) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `${endpoint}?${params.toString()}`;
}

async function fetchPage<T>(
  endpoint: string,
  page: number,
  limit: number,
  filters: Record<string, string | undefined>,
): Promise<PaginatedResponse<T>> {
  const response = await fetch(buildUrl(endpoint, page, limit, filters));
  if (!response.ok) throw new Error(`Erro ao carregar dados (${response.status})`);
  return preservePaginatedResponse<T>(await response.json(), { page, limit });
}

export async function fetchPaginatedQuery<T>({
  endpoint,
  page,
  limit,
  filters = {},
}: PaginatedQueryOptions): Promise<PaginatedResponse<T>> {
  return fetchPage<T>(endpoint, page, limit, filters);
}
