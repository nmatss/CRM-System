import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SessionUser } from "@shared/schema";

interface AuthResponse {
  user: SessionUser;
  message: string;
  mustChangePassword?: boolean;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery<SessionUser | null>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me");
      if (response.status === 401) {
        return null;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch user");
      }
      const data = await response.json();
      return data.user;
    },
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useMutation<AuthResponse, Error, { username: string; password: string }>({
    mutationFn: async (credentials) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Login failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data.user);
    },
  });

  const registerMutation = useMutation<AuthResponse, Error, { email: string; password: string; name: string; tenantName?: string }>({
    mutationFn: async (data) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Registration failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.invalidateQueries();
    },
  });

  const switchTenantMutation = useMutation<AuthResponse, Error, number>({
    mutationFn: async (tenantId) => {
      const response = await fetch(`/api/auth/switch-tenant/${tenantId}`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to switch tenant");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data.user);
      queryClient.invalidateQueries();
    },
  });

  const changePasswordMutation = useMutation<{ message: string }, Error, { currentPassword: string; newPassword: string; confirmPassword: string }>({
    mutationFn: async (data) => {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falha ao alterar senha");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isSuperAdmin: user?.isSuperAdmin ?? false,
    mustChangePassword: user?.mustChangePassword ?? false,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    switchTenant: switchTenantMutation.mutateAsync,
    changePassword: changePasswordMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    loginData: loginMutation.data,
  };
}
