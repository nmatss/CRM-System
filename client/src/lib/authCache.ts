import type { QueryClient } from "@tanstack/react-query";

export async function clearAuthenticatedQueryCache(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.removeQueries();
  queryClient.setQueryData(["auth", "me"], null);
}
