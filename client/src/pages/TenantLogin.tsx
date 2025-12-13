import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Store, User, Lock, ArrowLeft, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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

function formatCpf(value: string): string {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
}

function isNumericInput(value: string): boolean {
  return /^\d+$/.test(value.replace(/\D/g, ""));
}

export default function TenantLogin() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/loja/:slug");
  const slug = params?.slug;
  const { toast } = useToast();

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { data: tenant, isLoading: isLoadingTenant, error: tenantError } = useQuery<TenantInfo>({
    queryKey: ["tenant", slug],
    queryFn: async () => {
      const response = await fetch(`/api/tenants/by-slug/${slug}`);
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
    const value = e.target.value;
    const cleanValue = value.replace(/[.\-]/g, "");
    
    if (isNumericInput(cleanValue) && cleanValue.length <= 11) {
      setLoginForm({ ...loginForm, username: formatCpf(cleanValue) });
    } else {
      setLoginForm({ ...loginForm, username: value });
    }
  };

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
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
          await apiRequest("POST", `/api/auth/switch-tenant/${tenant.id}`);
        } catch (e) {
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
    mutationFn: async (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
      const response = await apiRequest("POST", "/api/auth/change-password", data);
      return response.json();
    },
    onSuccess: async () => {
      if (tenant) {
        try {
          await apiRequest("POST", `/api/auth/switch-tenant/${tenant.id}`);
        } catch (e) {
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
    const cleanUsername = loginForm.username.replace(/[.\-]/g, "");
    loginMutation.mutate({ username: cleanUsername, password: loginForm.password });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      toast({ title: "Erro", description: "A nova senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <Card className="w-full max-w-md text-center" data-testid="tenant-not-found-card">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center">
                <Store className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-600">Loja não encontrada</CardTitle>
            <CardDescription>
              A loja que você está procurando não existe ou não está disponível.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              className="w-full"
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
  const gradientStyle = { background: `linear-gradient(to bottom right, ${primaryColor}, ${secondaryColor})` };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(to bottom right, ${primaryColor}15, ${secondaryColor}15)` }}
    >
      <Card className="w-full max-w-md" data-testid="tenant-login-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {tenant.logo ? (
              <img 
                src={tenant.logo} 
                alt={tenant.name} 
                className="w-16 h-16 rounded-xl object-cover"
                data-testid="tenant-logo"
              />
            ) : (
              <div 
                className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={gradientStyle}
              >
                <Store className="w-8 h-8 text-white" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold" data-testid="tenant-name">{tenant.name}</CardTitle>
          <CardDescription>
            {tenant.loginMessage || "Entre com suas credenciais para acessar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-username">CPF ou Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-username"
                  type="text"
                  placeholder="Digite seu CPF ou email"
                  className="pl-10"
                  value={loginForm.username}
                  onChange={handleUsernameChange}
                  required
                  data-testid="input-tenant-username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                  data-testid="input-tenant-password"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              style={gradientStyle}
              disabled={loginMutation.isPending}
              data-testid="button-tenant-login"
            >
              {loginMutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => setLocation("/")}
              className="text-muted-foreground"
              data-testid="link-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Moda CRM
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPasswordModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" data-testid="password-change-modal">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={gradientStyle}>
                <KeyRound className="w-6 h-6 text-white" />
              </div>
            </div>
            <DialogTitle className="text-xl text-center">Alterar Senha</DialogTitle>
            <DialogDescription className="text-center">
              Este é seu primeiro acesso. Por segurança, você precisa criar uma nova senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha Atual</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                  data-testid="input-current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  className="pl-10 pr-10"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full"
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
