import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Store, Mail, Lock, User } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, register, isLoggingIn, isRegistering } = useAuth();
  const { toast } = useToast();

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ 
    email: "", 
    password: "", 
    name: "", 
    tenantName: "" 
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(loginForm);
      toast({ title: "Bem-vindo de volta!", description: "Login realizado com sucesso." });
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Erro no login", description: error.message, variant: "destructive" });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register({
        ...registerForm,
        tenantName: registerForm.tenantName || undefined,
      });
      toast({ title: "Conta criada!", description: "Bem-vindo ao Moda CRM." });
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md" data-testid="login-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Store className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Moda CRM</CardTitle>
          <CardDescription>Sistema de gestão para lojas de moda</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" data-testid="tab-login">Entrar</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">Criar Conta</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
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
                      data-testid="input-login-email"
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
                      data-testid="input-login-password"
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                  disabled={isLoggingIn}
                  data-testid="button-login"
                >
                  {isLoggingIn ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Seu nome"
                      className="pl-10"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      required
                      data-testid="input-register-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-10"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      required
                      data-testid="input-register-email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      className="pl-10"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      required
                      minLength={6}
                      data-testid="input-register-password"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-tenant">Nome da Loja (opcional)</Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-tenant"
                      type="text"
                      placeholder="Minha Loja de Moda"
                      className="pl-10"
                      value={registerForm.tenantName}
                      onChange={(e) => setRegisterForm({ ...registerForm, tenantName: e.target.value })}
                      data-testid="input-register-tenant"
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                  disabled={isRegistering}
                  data-testid="button-register"
                >
                  {isRegistering ? "Criando conta..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
