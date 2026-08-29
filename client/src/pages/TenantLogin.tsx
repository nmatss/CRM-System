import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Store, User, Lock, ArrowLeft, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, clearCsrfToken } from "@/lib/queryClient";
import { formatLoginIdentifierInput, normalizeLoginIdentifier } from "@/lib/loginIdentifier";
import { clearAuthenticatedQueryCache } from "@/lib/authCache";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  logo?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  loginMessage?: string | null;
}

export default function TenantLogin() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/loja/:slug");
  const slug = params?.slug;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    data: tenant,
    isLoading: isLoadingTenant,
    error: tenantError,
  } = useQuery<TenantInfo>({
    queryKey: ["tenant", slug],
    queryFn: async () => {
      const response = await fetch(`/api/v1/tenants/by-slug/${slug}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Loja não encontrada");
      }
      return response.json();
    },
    enabled: !!slug,
    retry: false,
  });

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginForm({ ...loginForm, username: formatLoginIdentifierInput(e.target.value) });
  };

  const clearTenantLoginSession = async () => {
    try {
      await apiRequest("POST", "/auth/logout");
    } catch {
      // Best-effort cleanup only; local auth cache still needs to be cleared.
    }
    clearCsrfToken();
    await clearAuthenticatedQueryCache(queryClient);
  };

  const switchToTenant = async () => {
    if (!tenant) {
      return;
    }

    const response = await apiRequest("POST", `/auth/switch-tenant/${tenant.id}`);
    const switched = await response.json();
    if (!switched.user) {
      throw new Error("Não foi possível selecionar a loja.");
    }
    queryClient.setQueryData(["auth", "me"], switched.user);
  };

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro no login");
      }
      return response.json();
    },
    onSuccess: async (data) => {
      if (data.user?.mustChangePassword) {
        setPasswordForm({ ...passwordForm, currentPassword: loginForm.password });
        setShowPasswordModal(true);
        toast({
          title: "Primeiro acesso detectado",
          description: "Por segurança, você precisa alterar sua senha.",
        });
        return;
      }

      if (tenant && data.user) {
        try {
          await switchToTenant();
        } catch (e) {
          await clearTenantLoginSession();
          toast({
            title: "Erro no login",
            description: e instanceof Error ? e.message : "Não foi possível acessar esta loja.",
            variant: "destructive",
          });
          return;
        }
      }
      toast({ title: "Bem-vindo!", description: `Login realizado com sucesso.` });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({ title: "Erro no login", description: error.message, variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      const response = await apiRequest("POST", "/auth/change-password", data);
      return response.json();
    },
    onSuccess: async () => {
      if (tenant) {
        try {
          await switchToTenant();
        } catch (e) {
          await clearTenantLoginSession();
          toast({
            title: "Erro",
            description: e instanceof Error ? e.message : "Não foi possível acessar esta loja.",
            variant: "destructive",
          });
          return;
        }
      }
      toast({ title: "Senha alterada!", description: "Sua senha foi alterada com sucesso." });
      setShowPasswordModal(false);
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({
      username: normalizeLoginIdentifier(loginForm.username),
      password: loginForm.password,
    });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    if (passwordForm.newPassword.length < 12) {
      toast({
        title: "Erro",
        description: "A nova senha deve ter pelo menos 12 caracteres.",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword,
    });
  };

  if (isLoadingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm sm:text-base">Carregando...</p>
        </div>
      </div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 px-4 py-8">
        <Card
          className="w-full max-w-sm sm:max-w-md text-center"
          data-testid="tenant-not-found-card"
        >
          <CardHeader className="px-4 sm:px-6 pt-6 sm:pt-8">
            <div className="flex justify-center mb-3 sm:mb-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-200 rounded-xl flex items-center justify-center">
                <Store className="w-7 h-7 sm:w-8 sm:h-8 text-gray-400" />
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-gray-600">
              Loja não encontrada
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              A loja que você está procurando não existe ou não está disponível.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-6">
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="w-full h-12 text-base"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para a página inicial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = tenant.primaryColor || "#9333ea";
  const secondaryColor = tenant.secondaryColor || "#db2777";
  const gradientStyle = {
    background: `linear-gradient(to bottom right, ${primaryColor}, ${secondaryColor})`,
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        background: `linear-gradient(to bottom right, ${primaryColor}15, ${secondaryColor}15)`,
      }}
    >
      <Card className="w-full max-w-sm sm:max-w-md" data-testid="tenant-login-card">
        <CardHeader className="text-center px-4 sm:px-6 pt-6 sm:pt-8">
          <div className="flex justify-center mb-3 sm:mb-4">
            {tenant.logo ? (
              <img
                src={tenant.logo}
                alt={tenant.name}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover"
                data-testid="tenant-logo"
              />
            ) : (
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center"
                style={gradientStyle}
              >
                <Store className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
            )}
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold" data-testid="tenant-name">
            {tenant.name}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            {tenant.loginMessage || "Entre com suas credenciais para acessar"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6">
          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
            <div className="space-y-2">
              <Label htmlFor="login-username" className="text-sm sm:text-base">
                CPF ou Email
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <Input
                  id="login-username"
                  type="text"
                  placeholder="Digite seu CPF ou email"
                  className="w-full h-12 pl-10 sm:pl-11 text-base"
                  value={loginForm.username}
                  onChange={handleUsernameChange}
                  required
                  data-testid="input-tenant-username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-sm sm:text-base">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  className="w-full h-12 pl-10 sm:pl-11 text-base"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                  data-testid="input-tenant-password"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium"
              style={gradientStyle}
              disabled={loginMutation.isPending}
              data-testid="button-tenant-login"
            >
              {loginMutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-5 sm:mt-6 text-center">
            <Button
              variant="link"
              onClick={() => setLocation("/")}
              className="text-muted-foreground min-h-[44px] text-sm sm:text-base"
              data-testid="link-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Moda CRM
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPasswordModal} onOpenChange={() => {}}>
        <DialogContent
          className="w-[calc(100%-2rem)] max-w-sm sm:max-w-md"
          data-testid="password-change-modal"
        >
          <DialogHeader className="px-1">
            <div className="flex justify-center mb-3 sm:mb-4">
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center"
                style={gradientStyle}
              >
                <KeyRound className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
            <DialogTitle className="text-lg sm:text-xl text-center">Alterar Senha</DialogTitle>
            <DialogDescription className="text-center text-sm sm:text-base">
              Este é seu primeiro acesso. Por segurança, você precisa criar uma nova senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4 mt-2 sm:mt-4">
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-sm sm:text-base">
                Senha Atual
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full h-12 pl-10 sm:pl-11 pr-11 sm:pr-12 text-base"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  required
                  data-testid="input-current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label={showCurrentPassword ? "Ocultar senha atual" : "Mostrar senha atual"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm sm:text-base">
                Nova Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Mínimo 12 caracteres"
                  className="w-full h-12 pl-10 sm:pl-11 pr-11 sm:pr-12 text-base"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                  minLength={12}
                  required
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm sm:text-base">
                Confirmar Nova Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full h-12 pl-10 sm:pl-11 pr-11 sm:pr-12 text-base"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  required
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword
                      ? "Ocultar confirmação de senha"
                      : "Mostrar confirmação de senha"
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium"
              style={gradientStyle}
              disabled={changePasswordMutation.isPending}
              data-testid="button-change-password"
            >
              {changePasswordMutation.isPending ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
