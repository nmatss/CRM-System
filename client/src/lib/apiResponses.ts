export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function unwrapList<T>(payload: T[] | PaginatedResponse<T> | null | undefined): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray((payload as PaginatedResponse<T>).data)) {
    return (payload as PaginatedResponse<T>).data;
  }

  return [];
}

export function preservePaginatedResponse<T>(
  payload: T[] | Partial<PaginatedResponse<T>> | null | undefined,
  fallback: Pick<PaginationMetadata, "page" | "limit">,
): PaginatedResponse<T> {
  const data = unwrapList(payload as T[] | PaginatedResponse<T> | null | undefined);
  const metadata = !Array.isArray(payload) ? payload?.pagination : undefined;
  const page = metadata?.page ?? fallback.page;
  const limit = metadata?.limit ?? fallback.limit;
  const total = metadata?.total ?? data.length;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: metadata?.totalPages ?? Math.max(1, Math.ceil(total / limit)),
    },
  };
}
