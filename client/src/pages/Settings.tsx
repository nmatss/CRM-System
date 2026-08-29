import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { apiRequest } from "@/lib/queryClient";
import { safeSettingsImageUrl, settingsErrorDescription } from "@/lib/settingsErrors";
import {
  Plus,
  Users,
  Trash2,
  KeyRound,
  CreditCard,
  Hash,
  Mail,
  Phone,
  Store,
  Palette,
  Image,
  Loader2,
  Save,
  MessageSquare,
} from "lucide-react";
import type { User, TenantUser, Tenant } from "@shared/schema";

type UserWithoutPassword = Omit<User, "password">;

interface TeamMember extends TenantUser {
  user: UserWithoutPassword;
}

interface StoreSettings {
  name: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  loginMessage: string;
}

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isManager = user?.role === "manager" || user?.isSuperAdmin;

  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [passwordResetTarget, setPasswordResetTarget] = useState<TeamMember | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState({ password: "", confirmation: "" });
  const [newMember, setNewMember] = useState({
    name: "",
    cpf: "",
    sellerCode: "",
    phone: "",
    email: "",
    password: "",
    role: "seller",
  });

  const [storeSettingsOverride, setStoreSettings] = useState<StoreSettings | null>(null);

  const tenantQuery = useQuery<Tenant>({
    queryKey: ["tenant-settings"],
    queryFn: async () => {
      const response = await fetch("/api/v1/tenant/settings", { credentials: "include" });
      if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
      return response.json();
    },
    enabled: isManager,
  });
  const { data: tenantData } = tenantQuery;
  const storeSettings: StoreSettings = storeSettingsOverride ?? {
    name: tenantData?.name || "",
    logo: tenantData?.logo || "",
    primaryColor: tenantData?.primaryColor || "#9333ea",
    secondaryColor: tenantData?.secondaryColor || "#db2777",
    loginMessage: tenantData?.loginMessage || "",
  };

  const updateTenantMutation = useMutation({
    mutationFn: async (data: Partial<Tenant>) => {
      const response = await apiRequest("PUT", "/tenant/settings", data);
      return response.json();
    },
    onSuccess: () => {
      setStoreSettings(null);
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      toast({
        title: "Configurações salvas!",
        description: "As configurações da loja foram atualizadas.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: settingsErrorDescription(
          error,
          "Não foi possível salvar as configurações da loja.",
        ),
        variant: "destructive",
      });
    },
  });

  const handleSaveStoreSettings = () => {
    if (storeSettings.logo && !safeSettingsImageUrl(storeSettings.logo)) {
      toast({
        title: "URL do logo inválida",
        description: "Use um caminho interno ou uma URL HTTP(S).",
        variant: "destructive",
      });
      return;
    }
    updateTenantMutation.mutate(storeSettings);
  };

  const teamQuery = useQuery<TeamMember[]>({
    queryKey: ["team"],
    queryFn: async () => {
      const response = await fetch("/api/v1/team", { credentials: "include" });
      if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
      return response.json();
    },
    enabled: isManager,
  });
  const team = teamQuery.data ?? [];

  const createMemberMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      cpf?: string;
      sellerCode?: string;
      phone?: string;
      email: string;
      password: string;
      role: string;
    }) => {
      const response = await apiRequest("POST", "/team", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setIsAddMemberDialogOpen(false);
      setNewMember({
        name: "",
        cpf: "",
        sellerCode: "",
        phone: "",
        email: "",
        password: "",
        role: "seller",
      });
      toast({
        title: "Membro adicionado!",
        description: "Novo membro da equipe criado com sucesso.",
      });
    },
    onError: (error: Error) => {
      setNewMember((current) => ({ ...current, password: "" }));
      toast({
        title: "Erro",
        description: settingsErrorDescription(error, "Não foi possível adicionar o membro."),
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const response = await apiRequest("POST", `/team/${userId}/reset-password`, { newPassword });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setPasswordResetTarget(null);
      setTemporaryPassword({ password: "", confirmation: "" });
      toast({
        title: "Senha resetada!",
        description: "Informe a senha temporária ao usuário por canal seguro.",
      });
    },
    onError: (error: Error) => {
      setTemporaryPassword({ password: "", confirmation: "" });
      toast({
        title: "Erro",
        description: settingsErrorDescription(error, "Não foi possível resetar a senha."),
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("DELETE", `/team/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Membro removido!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: settingsErrorDescription(error, "Não foi possível remover o membro."),
        variant: "destructive",
      });
    },
  });

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCpf = newMember.cpf.replace(/\D/g, "");
    createMemberMutation.mutate({
      name: newMember.name,
      cpf: cleanedCpf || undefined,
      sellerCode: newMember.sellerCode || undefined,
      phone: newMember.phone || undefined,
      email: newMember.email,
      password: newMember.password,
      role: newMember.role,
    });
  };

  const handleResetPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordResetTarget) return;
    if (temporaryPassword.password.length < 12) {
      toast({
        title: "Senha muito curta",
        description: "Use pelo menos 12 caracteres.",
        variant: "destructive",
      });
      return;
    }
    if (temporaryPassword.password !== temporaryPassword.confirmation) {
      toast({
        title: "Senhas diferentes",
        description: "A confirmação deve ser igual à senha temporária.",
        variant: "destructive",
      });
      return;
    }
    resetPasswordMutation.mutate({
      userId: passwordResetTarget.userId,
      newPassword: temporaryPassword.password,
    });
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9)
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  };

  return (
    <Layout>
      <div className="flex flex-col gap-4 sm:gap-6 pb-20 sm:pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Gerencie as preferências da sua loja e conta.
          </p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 border-b rounded-none bg-transparent p-0 h-auto">
              <TabsTrigger
                value="general"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-2.5 text-xs sm:text-sm whitespace-nowrap"
              >
                Geral
              </TabsTrigger>
              {isManager && (
                <TabsTrigger
                  value="store"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-2.5 text-xs sm:text-sm whitespace-nowrap"
                >
                  Loja
                </TabsTrigger>
              )}
              <TabsTrigger
                value="notifications"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-2.5 text-xs sm:text-sm whitespace-nowrap"
              >
                Notificações
              </TabsTrigger>
              {isManager && (
                <TabsTrigger
                  value="team"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-2.5 text-xs sm:text-sm whitespace-nowrap"
                >
                  Equipe
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="general" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Perfil</CardTitle>
                <CardDescription>Suas informações pessoais.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <Avatar className="h-20 w-20 sm:h-20 sm:w-20">
                    <AvatarFallback>{user?.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm text-muted-foreground">
                    A edição de foto ainda não é suportada pela API.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input id="name" value={user?.name || ""} className="w-full" readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user?.email || ""} className="w-full" readOnly />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Aparência</CardTitle>
                <CardDescription>Personalize como o sistema se parece.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <Label>Modo Escuro</Label>
                    <p className="text-sm text-muted-foreground">
                      Alternar entre tema claro e escuro.
                    </p>
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                    aria-label="Alternar modo escuro"
                    data-testid="switch-dark-mode"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isManager && (
            <TabsContent value="store" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Store className="h-4 w-4 sm:h-5 sm:w-5" />
                    Informações da Loja
                  </CardTitle>
                  <CardDescription>
                    Configure o nome e identidade visual da sua loja.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  {tenantQuery.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : tenantQuery.isError ? (
                    <div className="space-y-3 py-6 text-center" role="alert">
                      <p className="text-sm text-destructive">
                        {settingsErrorDescription(
                          tenantQuery.error,
                          "Não foi possível carregar as configurações da loja.",
                        )}
                      </p>
                      <Button variant="outline" size="sm" onClick={() => tenantQuery.refetch()}>
                        Tentar novamente
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="store-name">Nome da Loja</Label>
                          <Input
                            id="store-name"
                            value={storeSettings.name}
                            onChange={(e) =>
                              setStoreSettings({ ...storeSettings, name: e.target.value })
                            }
                            placeholder="Minha Loja"
                            data-testid="input-store-name"
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="store-logo">URL do Logo</Label>
                          <Input
                            id="store-logo"
                            value={storeSettings.logo}
                            onChange={(e) =>
                              setStoreSettings({ ...storeSettings, logo: e.target.value })
                            }
                            placeholder="https://exemplo.com/logo.png"
                            data-testid="input-store-logo"
                            className="w-full"
                          />
                        </div>
                      </div>

                      {safeSettingsImageUrl(storeSettings.logo) && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2">
                            <Image className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs sm:text-sm text-muted-foreground">
                              Preview do logo:
                            </span>
                          </div>
                          <img
                            src={safeSettingsImageUrl(storeSettings.logo)}
                            alt="Logo da loja"
                            className="h-10 sm:h-12 w-auto object-contain max-w-full"
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
                    Cores do Tema
                  </CardTitle>
                  <CardDescription>Personalize as cores da sua loja.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  <div className="space-y-4 sm:space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="primary-color">Cor Primária</Label>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <input
                          type="color"
                          id="primary-color"
                          value={storeSettings.primaryColor}
                          onChange={(e) =>
                            setStoreSettings({ ...storeSettings, primaryColor: e.target.value })
                          }
                          className="w-10 h-10 sm:w-12 sm:h-10 rounded border cursor-pointer flex-shrink-0"
                          data-testid="input-primary-color"
                          disabled={tenantQuery.isLoading || tenantQuery.isError}
                        />
                        <Input
                          value={storeSettings.primaryColor}
                          onChange={(e) =>
                            setStoreSettings({ ...storeSettings, primaryColor: e.target.value })
                          }
                          className="flex-1 w-full"
                          placeholder="#9333ea"
                          disabled={tenantQuery.isLoading || tenantQuery.isError}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondary-color">Cor Secundária</Label>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <input
                          type="color"
                          id="secondary-color"
                          value={storeSettings.secondaryColor}
                          onChange={(e) =>
                            setStoreSettings({ ...storeSettings, secondaryColor: e.target.value })
                          }
                          className="w-10 h-10 sm:w-12 sm:h-10 rounded border cursor-pointer flex-shrink-0"
                          data-testid="input-secondary-color"
                          disabled={tenantQuery.isLoading || tenantQuery.isError}
                        />
                        <Input
                          value={storeSettings.secondaryColor}
                          onChange={(e) =>
                            setStoreSettings({ ...storeSettings, secondaryColor: e.target.value })
                          }
                          className="flex-1 w-full"
                          placeholder="#db2777"
                          disabled={tenantQuery.isLoading || tenantQuery.isError}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 p-3 sm:p-4 border rounded-lg bg-muted/30">
                    <div
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0"
                      style={{ backgroundColor: storeSettings.primaryColor }}
                    >
                      P
                    </div>
                    <div
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0"
                      style={{ backgroundColor: storeSettings.secondaryColor }}
                    >
                      S
                    </div>
                    <div
                      className="flex-1 h-14 sm:h-16 rounded-lg min-w-[120px]"
                      style={{
                        background: `linear-gradient(to right, ${storeSettings.primaryColor}, ${storeSettings.secondaryColor})`,
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                    Mensagem de Login
                  </CardTitle>
                  <CardDescription>Mensagem exibida na tela de login da loja.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={storeSettings.loginMessage}
                    onChange={(e) =>
                      setStoreSettings({ ...storeSettings, loginMessage: e.target.value })
                    }
                    placeholder="Ex: Bem-vindo à nossa loja! Digite seu CPF ou código de vendedor para acessar."
                    className="min-h-[100px] w-full resize-none"
                    data-testid="textarea-login-message"
                    disabled={tenantQuery.isLoading || tenantQuery.isError}
                  />
                </CardContent>
              </Card>

              <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t sm:border-t-0 p-4 sm:p-0 -mx-4 sm:mx-0 sm:bg-transparent sm:backdrop-blur-none sm:relative">
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveStoreSettings}
                    disabled={
                      updateTenantMutation.isPending || tenantQuery.isLoading || tenantQuery.isError
                    }
                    className="gap-2 w-full sm:w-auto min-h-[44px]"
                    data-testid="button-save-store-settings"
                  >
                    {updateTenantMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar Configurações
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}

          <TabsContent value="notifications" className="mt-4 sm:mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>Disponibilidade das preferências pessoais.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  A API atual permite consultar notificações, mas ainda não oferece um contrato para
                  salvar preferências de pedidos, estoque ou relatórios. Nenhuma opção é simulada
                  nesta tela.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {isManager && (
            <TabsContent value="team" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">Equipe</h2>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    Gerencie os vendedores da sua loja
                  </p>
                </div>
                <Dialog
                  open={isAddMemberDialogOpen}
                  onOpenChange={(open) => {
                    setIsAddMemberDialogOpen(open);
                    if (!open && !createMemberMutation.isPending) {
                      setNewMember({
                        name: "",
                        cpf: "",
                        sellerCode: "",
                        phone: "",
                        email: "",
                        password: "",
                        role: "seller",
                      });
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      data-testid="button-add-member"
                      size="sm"
                      className="w-full sm:w-auto min-h-[44px]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Vendedor
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Novo Membro da Equipe</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateMember} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="member-name">Nome *</Label>
                        <Input
                          id="member-name"
                          value={newMember.name}
                          onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                          required
                          data-testid="input-member-name"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="member-cpf">CPF</Label>
                          <Input
                            id="member-cpf"
                            value={newMember.cpf}
                            onChange={(e) =>
                              setNewMember({ ...newMember, cpf: formatCpf(e.target.value) })
                            }
                            placeholder="000.000.000-00"
                            data-testid="input-member-cpf"
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="member-sellerCode">Código Vendedor</Label>
                          <Input
                            id="member-sellerCode"
                            value={newMember.sellerCode}
                            onChange={(e) =>
                              setNewMember({ ...newMember, sellerCode: e.target.value })
                            }
                            placeholder="Ex: V001"
                            data-testid="input-member-seller-code"
                            className="w-full"
                          />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="member-phone">Telefone</Label>
                          <Input
                            id="member-phone"
                            value={newMember.phone}
                            onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                            placeholder="(00) 00000-0000"
                            data-testid="input-member-phone"
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="member-email">Email *</Label>
                          <Input
                            id="member-email"
                            type="email"
                            value={newMember.email}
                            onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                            required
                            data-testid="input-member-email"
                            className="w-full"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="member-password">Senha temporária *</Label>
                        <Input
                          id="member-password"
                          type="password"
                          autoComplete="new-password"
                          value={newMember.password}
                          onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                          minLength={12}
                          required
                          data-testid="input-member-password"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Função</Label>
                        <Select
                          value={newMember.role}
                          onValueChange={(value) => setNewMember({ ...newMember, role: value })}
                        >
                          <SelectTrigger data-testid="select-member-role" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="seller">Vendedor</SelectItem>
                            <SelectItem value="manager">Gerente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Use uma senha temporária forte, com pelo menos 12 caracteres. O usuário
                        deverá alterá-la no primeiro acesso.
                      </p>
                      <Button
                        type="submit"
                        className="w-full min-h-[44px]"
                        disabled={createMemberMutation.isPending}
                        data-testid="button-submit-member"
                      >
                        {createMemberMutation.isPending ? "Criando..." : "Criar Membro"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardContent className="pt-4 sm:pt-6">
                  {teamQuery.isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : teamQuery.isError ? (
                    <div className="space-y-3 py-8 text-center" role="alert">
                      <p className="text-sm text-destructive">
                        {settingsErrorDescription(
                          teamQuery.error,
                          "Não foi possível carregar a equipe.",
                        )}
                      </p>
                      <Button variant="outline" size="sm" onClick={() => teamQuery.refetch()}>
                        Tentar novamente
                      </Button>
                    </div>
                  ) : team.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum membro na equipe ainda. Adicione seu primeiro vendedor!
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {team.map((member) => (
                        <div
                          key={member.userId}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg gap-3"
                          data-testid={`team-member-row-${member.userId}`}
                        >
                          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                            <div className="w-10 h-10 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <Users className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm sm:text-base truncate">
                                {member.user.name}
                              </div>
                              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-1">
                                {member.user.cpf && (
                                  <span className="flex items-center gap-1">
                                    <CreditCard className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">
                                      {member.user.cpf.replace(
                                        /(\d{3})(\d{3})(\d{3})(\d{2})/,
                                        "$1.$2.$3-$4",
                                      )}
                                    </span>
                                  </span>
                                )}
                                {member.user.sellerCode && (
                                  <span className="flex items-center gap-1">
                                    <Hash className="w-3 h-3 flex-shrink-0" />
                                    <span>{member.user.sellerCode}</span>
                                  </span>
                                )}
                                {member.user.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{member.user.email}</span>
                                  </span>
                                )}
                                {member.user.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 flex-shrink-0" />
                                    <span>{member.user.phone}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={member.role === "manager" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {member.role === "manager" ? "Gerente" : "Vendedor"}
                              </Badge>
                              {member.user.mustChangePassword && (
                                <Badge
                                  variant="outline"
                                  className="text-orange-600 border-orange-300 text-xs whitespace-nowrap"
                                >
                                  Primeiro acesso
                                </Badge>
                              )}
                            </div>
                            {member.userId !== user?.id && (
                              <div className="flex items-center gap-1 sm:gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-blue-500 hover:text-blue-700 h-9 w-9 sm:h-10 sm:w-10"
                                  title="Resetar Senha"
                                  data-testid={`button-reset-password-${member.userId}`}
                                  onClick={() => setPasswordResetTarget(member)}
                                >
                                  <KeyRound className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-red-500 hover:text-red-700 h-9 w-9 sm:h-10 sm:w-10"
                                      title="Remover"
                                      data-testid={`button-remove-member-${member.userId}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remover Membro?</AlertDialogTitle>
                                      <AlertDialogDescription className="text-sm">
                                        "{member.user.name}" será removido da equipe. Esta ação não
                                        pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                      <AlertDialogCancel className="w-full sm:w-auto">
                                        Cancelar
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-red-500 hover:bg-red-600 w-full sm:w-auto"
                                        onClick={() => removeMemberMutation.mutate(member.userId)}
                                      >
                                        Remover
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Dialog
                open={passwordResetTarget !== null}
                onOpenChange={(open) => {
                  if (!open && !resetPasswordMutation.isPending) {
                    setPasswordResetTarget(null);
                    setTemporaryPassword({ password: "", confirmation: "" });
                  }
                }}
              >
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Definir senha temporária</DialogTitle>
                    <DialogDescription>
                      Defina uma senha com pelo menos 12 caracteres para{" "}
                      {passwordResetTarget?.user.name}. A pessoa deverá alterá-la no primeiro
                      acesso.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="temporary-password">Senha temporária</Label>
                      <Input
                        id="temporary-password"
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        required
                        value={temporaryPassword.password}
                        onChange={(event) =>
                          setTemporaryPassword((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        disabled={resetPasswordMutation.isPending}
                        data-testid="input-temporary-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="temporary-password-confirmation">Confirmar senha</Label>
                      <Input
                        id="temporary-password-confirmation"
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        required
                        value={temporaryPassword.confirmation}
                        onChange={(event) =>
                          setTemporaryPassword((current) => ({
                            ...current,
                            confirmation: event.target.value,
                          }))
                        }
                        disabled={resetPasswordMutation.isPending}
                        data-testid="input-temporary-password-confirmation"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Compartilhe a senha somente por um canal seguro. Ela não será exibida
                      novamente.
                    </p>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={resetPasswordMutation.isPending}
                        onClick={() => {
                          setPasswordResetTarget(null);
                          setTemporaryPassword({ password: "", confirmation: "" });
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={resetPasswordMutation.isPending}>
                        {resetPasswordMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Resetar senha
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
