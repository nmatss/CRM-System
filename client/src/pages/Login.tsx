import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Store, User, Lock, Sparkles, ArrowLeft, KeyRound, Eye, EyeOff } from "lucide-react";
import zippiLogo from "@assets/generated_images/zippi_crm_modern_logo.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isLoggingIn, changePassword, isChangingPassword } = useAuth();
  const { toast } = useToast();

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleanValue = value.replace(/[.\-]/g, "");
    
    if (isNumericInput(cleanValue) && cleanValue.length <= 11) {
      setLoginForm({ ...loginForm, username: formatCpf(cleanValue) });
    } else {
      setLoginForm({ ...loginForm, username: value });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanUsername = loginForm.username.replace(/[.\-]/g, "");
      const result = await login({ username: cleanUsername, password: loginForm.password });
      
      if (result.user?.mustChangePassword) {
        setPasswordForm({ ...passwordForm, currentPassword: loginForm.password });
        setShowPasswordModal(true);
        toast({ 
          title: "Primeiro acesso detectado", 
          description: "Por segurança, você precisa alterar sua senha.",
        });
      } else {
        toast({ title: "Bem-vindo de volta!", description: "Login realizado com sucesso." });
        setLocation("/dashboard");
      }
    } catch (error: any) {
      toast({ title: "Erro no login", description: error.message, variant: "destructive" });
    }
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
    
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      toast({ title: "Senha alterada!", description: "Sua senha foi alterada com sucesso." });
      setShowPasswordModal(false);
      setLocation("/dashboard");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-[#050A1A] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
      
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#050A1A]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button 
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Voltar</span>
            </button>
            <img 
              src={zippiLogo} 
              alt="Zippi CRM" 
              className="h-10 w-auto object-contain bg-[#050A1A] rounded"
              data-testid="header-logo"
            />
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <div className="min-h-screen flex items-center justify-center p-4 pt-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-3xl blur-3xl" />
          
          <Card className="relative bg-[#0F172A]/80 backdrop-blur-xl border-white/10 shadow-2xl" data-testid="login-card">
            <CardHeader className="text-center pb-2">
              <motion.div 
                className="flex justify-center mb-4"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <Store className="w-8 h-8 text-white" />
                </div>
              </motion.div>
              <CardTitle className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                Zippi CRM
              </CardTitle>
              <CardDescription className="text-gray-400">
                Acesse sua conta para continuar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username" className="text-gray-300">CPF ou Email</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                    <Input
                      id="login-username"
                      type="text"
                      placeholder="Digite seu CPF ou email"
                      className="pl-10 bg-[#1F2937]/50 border-white/10 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                      value={loginForm.username}
                      onChange={handleUsernameChange}
                      required
                      data-testid="input-login-username"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-gray-300">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10 bg-[#1F2937]/50 border-white/10 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                      data-testid="input-login-password"
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/25 transition-all"
                  disabled={isLoggingIn}
                  data-testid="button-login"
                >
                  {isLoggingIn ? "Entrando..." : "Entrar"}
                </Button>
              </form>
              
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  Não possui uma conta?{" "}
                  <span className="text-gray-400">
                    Entre em contato com o administrador do sistema.
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <motion.div 
            className="mt-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <p className="text-gray-500 text-sm">
              Precisa de ajuda?{" "}
              <button 
                onClick={() => setLocation("/")} 
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Entre em contato
              </button>
            </p>
          </motion.div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

      <Dialog open={showPasswordModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md bg-[#0F172A] border-white/10 text-white" data-testid="password-change-modal">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-white" />
              </div>
            </div>
            <DialogTitle className="text-xl text-center text-white">Alterar Senha</DialogTitle>
            <DialogDescription className="text-center text-gray-400">
              Este é seu primeiro acesso. Por segurança, você precisa criar uma nova senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-gray-300">Senha Atual</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10 bg-[#1F2937]/50 border-white/10 text-white placeholder:text-gray-500"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                  data-testid="input-current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-300"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-gray-300">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  className="pl-10 pr-10 bg-[#1F2937]/50 border-white/10 text-white placeholder:text-gray-500"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-300"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-gray-300">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10 bg-[#1F2937]/50 border-white/10 text-white placeholder:text-gray-500"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-300"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
              disabled={isChangingPassword}
              data-testid="button-change-password"
            >
              {isChangingPassword ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
