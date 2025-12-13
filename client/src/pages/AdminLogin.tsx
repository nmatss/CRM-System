import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, AlertTriangle } from "lucide-react";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { login, isLoggingIn } = useAuth();
  const { toast } = useToast();

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await login(loginForm);
      if (!result.user.isSuperAdmin) {
        toast({ 
          title: "Acesso Negado", 
          description: "Esta área é restrita a administradores do sistema.", 
          variant: "destructive" 
        });
        return;
      }
      toast({ title: "Bem-vindo, Admin!", description: "Acesso autorizado ao painel de controle." });
      setLocation("/admin");
    } catch (error: any) {
      toast({ title: "Erro no login", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-[#050A1A] text-white relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative p-4"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-600/20 rounded-3xl blur-3xl" />
        
        <Card className="relative bg-[#0F172A]/90 backdrop-blur-xl border-red-500/20 shadow-2xl" data-testid="admin-login-card">
          <CardHeader className="text-center pb-2">
            <motion.div 
              className="flex justify-center mb-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/25">
                <Shield className="w-8 h-8 text-white" />
              </div>
            </motion.div>
            <CardTitle className="text-2xl font-bold text-white flex items-center justify-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Área Restrita
            </CardTitle>
            <CardDescription className="text-gray-400">
              Acesso exclusivo para administradores do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs text-red-400 text-center">
                Esta página é monitorada. Tentativas de acesso não autorizadas serão registradas.
              </p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-gray-300">Email do Administrador</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@sistema.com"
                    className="pl-10 bg-[#1F2937]/50 border-red-500/20 text-white placeholder:text-gray-500 focus:border-red-500/50 focus:ring-red-500/20"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
                    data-testid="input-admin-email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-gray-300">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 bg-[#1F2937]/50 border-red-500/20 text-white placeholder:text-gray-500 focus:border-red-500/50 focus:ring-red-500/20"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                    data-testid="input-admin-password"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white shadow-lg shadow-red-500/25 transition-all"
                disabled={isLoggingIn}
                data-testid="button-admin-login"
              >
                {isLoggingIn ? "Verificando..." : "Acessar Sistema"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <motion.div 
          className="mt-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <p className="text-gray-600 text-xs">
            Zippi CRM - Painel Administrativo v1.0
          </p>
        </motion.div>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
    </div>
  );
}
