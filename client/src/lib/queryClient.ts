import { QueryClient, QueryFunction } from "@tanstack/react-query";

// CSRF token cache
let csrfToken: string | null = null;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Fetch a fresh CSRF token from the server
 */
async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch("/api/v1/csrf-token", {
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error("Failed to fetch CSRF token");
    }

    const data = await res.json();
    csrfToken = data.csrfToken;
    return csrfToken!; // We know it's not null after assignment
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    throw error;
  }
}

/**
 * Get the current CSRF token, fetching a new one if needed
 */
async function getCsrfToken(): Promise<string> {
  if (!csrfToken) {
    return await fetchCsrfToken();
  }
  return csrfToken;
}

/**
 * Clear the cached CSRF token (e.g., after logout or on token error)
 */
export function clearCsrfToken() {
  csrfToken = null;
}

export function normalizeApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("/api/health")) {
    return url;
  }

  if (url === "/api/v1" || url.startsWith("/api/v1/")) {
    return url;
  }

  if (url === "/api") {
    return "/api/v1";
  }

  if (url.startsWith("/api/")) {
    return url.replace(/^\/api(?=\/)/, "/api/v1");
  }

  const path = url.startsWith("/") ? url : `/${url}`;
  return `/api/v1${path}`;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const apiUrl = normalizeApiUrl(url);

  const headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};

  // Add CSRF token for state-changing requests
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase())) {
    try {
      const token = await getCsrfToken();
      headers["X-CSRF-Token"] = token;
    } catch (error) {
      console.error("Failed to get CSRF token:", error);
      // Continue without token - server will reject if needed
    }
  }

  const res = await fetch(apiUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // If we get a 403 with CSRF error, clear token and retry once
  if (res.status === 403) {
    const text = await res.text();
    if (text.includes("CSRF") || text.includes("csrf")) {
      csrfToken = null; // Clear cached token

      // Retry once with fresh token
      if (["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase())) {
        const token = await fetchCsrfToken();
        headers["X-CSRF-Token"] = token;

        const retryRes = await fetch(apiUrl, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
        });

        await throwIfResNotOk(retryRes);
        return retryRes;
      }
    }
    // Re-throw the original error
    throw new Error(`403: ${text}`);
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/");
    const apiUrl = normalizeApiUrl(url);

    const res = await fetch(apiUrl as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true, // Refetch on window focus for fresh data
      staleTime: 1000 * 60 * 5, // 5 minutes - data becomes stale after this
      gcTime: 1000 * 60 * 30, // 30 minutes - garbage collect after this
      retry: 1, // Retry once on failure
      retryDelay: 1000, // Wait 1 second before retry
    },
    mutations: {
      retry: false,
    },
  },
});
