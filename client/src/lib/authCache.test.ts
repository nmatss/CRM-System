import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { clearAuthenticatedQueryCache } from "./authCache";

describe("authenticated query cache", () => {
  it("removes tenant data without refetching and leaves an explicit logged-out state", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["auth", "me"], { id: "user-1", tenantId: 7 });
    queryClient.setQueryData(["customers", 7], [{ id: 1 }]);
    queryClient.setQueryData(["admin", "users"], [{ id: "user-1" }]);

    await clearAuthenticatedQueryCache(queryClient);

    expect(queryClient.getQueryData(["auth", "me"])).toBeNull();
    expect(queryClient.getQueryData(["customers", 7])).toBeUndefined();
    expect(queryClient.getQueryData(["admin", "users"])).toBeUndefined();
  });

  it("does not refetch an observed authenticated query while clearing logout state", async () => {
    const queryClient = new QueryClient();
    const queryFn = vi.fn(async () => [{ id: 1 }]);
    const queryKey = ["customers", 7] as const;

    await queryClient.prefetchQuery({ queryKey, queryFn, staleTime: Infinity });
    const observer = new QueryObserver(queryClient, { queryKey, queryFn, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => undefined);

    await clearAuthenticatedQueryCache(queryClient);
    await Promise.resolve();

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(queryKey)).toBeUndefined();
    expect(queryClient.getQueryData(["auth", "me"])).toBeNull();

    unsubscribe();
  });
});
