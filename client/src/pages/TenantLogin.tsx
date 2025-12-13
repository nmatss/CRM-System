import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Store, Mail, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

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

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: async (data) => {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginForm);
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
              <Label htmlFor="login-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-10"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  required
                  data-testid="input-tenant-email"
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
    </div>
  );
}
