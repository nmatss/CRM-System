import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Building2, Plus, Users, Store, Crown, Pencil, Copy, ExternalLink, MessageSquare, Calendar, Mail, Phone, CheckCircle2, Trash2, UserPlus, Link, BarChart3, ShoppingCart, Package, KeyRound, CreditCard, Hash } from "lucide-react";
import type { Tenant, ContactRequest, DemoRequest, User, TenantUser } from "@shared/schema";

const formatDate = (date: Date | string | null): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
};

type UserWithoutPassword = Omit<User, "password">;

interface UserWithTenants extends UserWithoutPassword {
  tenantUsers?: (TenantUser & { tenant?: Tenant })[];
}

export default function Admin() {
  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("dashboard");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: "", slug: "", plan: "free" });
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isAssignTenantDialogOpen, setIsAssignTenantDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", name: "", cpf: "", sellerCode: "", phone: "", isSuperAdmin: false, tenantId: "", role: "seller" });
  const [editingUser, setEditingUser] = useState<UserWithoutPassword | null>(null);
  const [editUserPassword, setEditUserPassword] = useState("");
  const [assigningUser, setAssigningUser] = useState<UserWithoutPassword | null>(null);
  const [assignTenantData, setAssignTenantData] = useState({ tenantId: "", role: "seller" });

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["admin", "tenants"],
    queryFn: async () => {
      const response = await fetch("/api/v1/admin/tenants");
      if (!response.ok) throw new Error("Failed to fetch tenants");
      return response.json();
    },
    enabled: isSuperAdmin,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<UserWithTenants[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const response = await fetch("/api/v1/admin/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
    enabled: isSuperAdmin,
  });

  const { data: contacts = [] } = useQuery<ContactRequest[]>({
    queryKey: ["admin", "contacts"],
    queryFn: async () => {
      const response = await fetch("/api/v1/admin/contacts");
      if (!response.ok) throw new Error("Failed to fetch contacts");
      return response.json();
    },
    enabled: isSuperAdmin,
  });

  const { data: demos = [] } = useQuery<DemoRequest[]>({
    queryKey: ["admin", "demos"],
    queryFn: async () => {
      const response = await fetch("/api/v1/admin/demos");
      if (!response.ok) throw new Error("Failed to fetch demos");
      return response.json();
    },
    enabled: isSuperAdmin,
  });

  interface TenantStats {
    tenantId: number;
    tenantName: string;
    usersCount: number;
    customersCount: number;
    ordersCount: number;
    productsCount: number;
  }

  const { data: tenantStats = [] } = useQuery<TenantStats[]>({
    queryKey: ["admin", "tenant-stats"],
    queryFn: async () => {
      const response = await fetch("/api/v1/admin/tenant-stats");
      if (!response.ok) throw new Error("Failed to fetch tenant stats");
      return response.json();
    },
    enabled: isSuperAdmin,
  });

  const updateContactStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/v1/admin/contacts/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "contacts"] });
      toast({ title: "Status atualizado!" });
    },
  });

  const updateDemoStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/v1/admin/demos/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "demos"] });
      toast({ title: "Status atualizado!" });
    },
  });

  const createTenantMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string; plan: string }) => {
      const response = await fetch("/api/v1/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, status: "active" }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create tenant");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      setIsDialogOpen(false);
      setNewTenant({ name: "", slug: "", plan: "free" });
      toast({ title: "Loja criada!", description: "Nova loja adicionada com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: async (data: Partial<Tenant> & { id: number }) => {
      const response = await fetch(`/api/v1/admin/tenants/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update tenant");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      setIsEditDialogOpen(false);
      setEditingTenant(null);
      toast({ title: "Loja atualizada!", description: "Personalização salva com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (tenantId: number) => {
      const response = await fetch(`/api/v1/admin/tenants/${tenantId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete tenant");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      toast({ title: "Loja excluída!", description: "A loja foi removida com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { email?: string; password: string; name: string; cpf?: string; sellerCode?: string; phone?: string; isSuperAdmin?: boolean; tenantId?: string; role?: string }) => {
      const response = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setIsUserDialogOpen(false);
      setNewUser({ email: "", password: "", name: "", cpf: "", sellerCode: "", phone: "", isSuperAdmin: false, tenantId: "", role: "seller" });
      toast({ title: "Usuário criado!", description: "Novo usuário adicionado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string; name?: string; email?: string; password?: string; isSuperAdmin?: boolean }) => {
      const response = await fetch(`/api/v1/admin/users/${data.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
      setEditUserPassword("");
      toast({ title: "Usuário atualizado!", description: "Dados salvos com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/v1/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "Usuário excluído!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const assignTenantMutation = useMutation({
    mutationFn: async (data: { userId: string; tenantId: number; role: string }) => {
      const response = await fetch(`/api/v1/admin/users/${data.userId}/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: data.tenantId, role: data.role }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign tenant");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setIsAssignTenantDialogOpen(false);
      setAssigningUser(null);
      setAssignTenantData({ tenantId: "", role: "seller" });
      toast({ title: "Usuário vinculado!", description: "Usuário agora tem acesso à loja." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const removeTenantUserMutation = useMutation({
    mutationFn: async (data: { userId: string; tenantId: number }) => {
      const response = await fetch(`/api/v1/admin/users/${data.userId}/tenants/${data.tenantId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove tenant user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "Vínculo removido!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/v1/admin/users/${userId}/reset-password`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "Senha resetada!", description: `Nova senha temporária: ${data.temporaryPassword}` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = newTenant.slug || newTenant.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    createTenantMutation.mutate({ ...newTenant, slug });
  };

  const handleUpdateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTenant) {
      updateTenantMutation.mutate(editingTenant);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCpf = newUser.cpf.replace(/\D/g, '');
    createUserMutation.mutate({
      name: newUser.name,
      email: newUser.email || undefined,
      cpf: cleanedCpf || undefined,
      sellerCode: newUser.sellerCode || undefined,
      phone: newUser.phone || undefined,
      password: newUser.password || newUser.sellerCode,
      isSuperAdmin: newUser.isSuperAdmin,
      tenantId: newUser.tenantId || undefined,
      role: newUser.tenantId ? newUser.role : undefined,
    });
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateUserMutation.mutate({
        userId: editingUser.id,
        name: editingUser.name || undefined,
        email: editingUser.email || undefined,
        password: editUserPassword || undefined,
        isSuperAdmin: editingUser.isSuperAdmin,
      });
    }
  };

  const handleAssignTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (assigningUser && assignTenantData.tenantId) {
      assignTenantMutation.mutate({
        userId: assigningUser.id,
        tenantId: parseInt(assignTenantData.tenantId),
        role: assignTenantData.role,
      });
    }
  };

  const openEditDialog = (tenant: Tenant) => {
    setEditingTenant({ ...tenant });
    setIsEditDialogOpen(true);
  };

  const openEditUserDialog = (u: UserWithoutPassword) => {
    setEditingUser({ ...u });
    setEditUserPassword("");
    setIsEditUserDialogOpen(true);
  };

  const openAssignTenantDialog = (u: UserWithoutPassword) => {
    setAssigningUser(u);
    setAssignTenantData({ tenantId: "", role: "seller" });
    setIsAssignTenantDialogOpen(true);
  };

  const copyLoginUrl = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/loja/${slug}`);
    toast({ title: "Link copiado!", description: "URL de login copiada para a área de transferência." });
  };

  const getTenantName = (tenantId: number) => {
    return tenants.find(t => t.id === tenantId)?.name || `Loja #${tenantId}`;
  };

  if (!isSuperAdmin) {
    return (
      <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md">
            <CardHeader className="text-center">
              <Crown className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
              <CardTitle>Acesso Restrito</CardTitle>
              <CardDescription>
                Esta área é exclusiva para administradores do sistema.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="admin-title">Painel Admin</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Gerencie lojas, usuários e solicitações do sistema</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Lojas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-tenants">{tenants.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Lojas Ativas</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-active-tenants">
                {tenants.filter((t) => t.status === "active").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-users">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Contatos</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-contacts">{contacts.length}</div>
              <p className="text-xs text-muted-foreground">{contacts.filter(c => c.status === "pending").length} pendentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Demos</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-demos">{demos.length}</div>
              <p className="text-xs text-muted-foreground">{demos.filter(d => d.status === "pending").length} pendentes</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-full sm:grid sm:grid-cols-6 min-w-max sm:min-w-0">
              <TabsTrigger value="dashboard" data-testid="tab-dashboard" className="whitespace-nowrap">Dashboard</TabsTrigger>
              <TabsTrigger value="empresas" data-testid="tab-empresas" className="whitespace-nowrap">Empresas</TabsTrigger>
              <TabsTrigger value="usuarios" data-testid="tab-usuarios" className="whitespace-nowrap">Usuários</TabsTrigger>
              <TabsTrigger value="relatorios" data-testid="tab-relatorios" className="whitespace-nowrap">Relatórios</TabsTrigger>
              <TabsTrigger value="contatos" data-testid="tab-contatos" className="whitespace-nowrap">Contatos</TabsTrigger>
              <TabsTrigger value="demos" data-testid="tab-demos" className="whitespace-nowrap">Demos</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="space-y-4">
            <h2 className="text-xl font-semibold">Visão Geral</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 border-purple-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Lojas Ativas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{tenants.filter((t) => t.status === "active").length}</div>
                  <p className="text-xs text-muted-foreground mt-1">de {tenants.length} total</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Usuários Ativos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{users.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">{users.filter(u => u.isSuperAdmin).length} admins</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-600/10 to-red-600/10 border-orange-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Contatos Pendentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{contacts.filter(c => c.status === "pending").length}</div>
                  <p className="text-xs text-muted-foreground mt-1">de {contacts.length} total</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-600/10 to-teal-600/10 border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Demos Pendentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{demos.filter(d => d.status === "pending").length}</div>
                  <p className="text-xs text-muted-foreground mt-1">de {demos.length} total</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Últimas Lojas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tenants.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhuma loja cadastrada.</p>
                  ) : (
                    <div className="space-y-3">
                      {tenants.slice(0, 5).map(t => (
                        <div key={t.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Store className="w-4 h-4 text-purple-600" />
                            <span className="font-medium">{t.name}</span>
                          </div>
                          <Badge variant={t.status === "active" ? "default" : "secondary"}>
                            {t.status === "active" ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Contatos Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {contacts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum contato recebido.</p>
                  ) : (
                    <div className="space-y-3">
                      {contacts.slice(0, 5).map(c => (
                        <div key={c.id} className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{c.name}</span>
                            <p className="text-xs text-muted-foreground">{c.email}</p>
                          </div>
                          <Badge variant={c.status === "pending" ? "secondary" : "default"}>
                            {c.status === "pending" ? "Pendente" : "Respondido"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="empresas" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h2 className="text-lg sm:text-xl font-semibold">Lojas Cadastradas</h2>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 w-full sm:w-auto" data-testid="button-add-tenant">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Loja
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Criar Nova Loja</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateTenant} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tenant-name">Nome da Loja</Label>
                      <Input
                        id="tenant-name"
                        value={newTenant.name}
                        onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                        placeholder="Boutique Fashion"
                        required
                        data-testid="input-tenant-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tenant-slug">Slug (identificador único)</Label>
                      <Input
                        id="tenant-slug"
                        value={newTenant.slug}
                        onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
                        placeholder="boutique-fashion"
                        data-testid="input-tenant-slug"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tenant-plan">Plano</Label>
                      <Select 
                        value={newTenant.plan} 
                        onValueChange={(value) => setNewTenant({ ...newTenant, plan: value })}
                      >
                        <SelectTrigger data-testid="select-tenant-plan">
                          <SelectValue placeholder="Selecione um plano" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Gratuito</SelectItem>
                          <SelectItem value="basic">Básico</SelectItem>
                          <SelectItem value="pro">Profissional</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={createTenantMutation.isPending}
                      data-testid="button-submit-tenant"
                    >
                      {createTenantMutation.isPending ? "Criando..." : "Criar Loja"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : tenants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma loja cadastrada ainda.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tenants.map((tenant) => (
                      <div
                        key={tenant.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg"
                        data-testid={`tenant-row-${tenant.id}`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                            <Store className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{tenant.name}</div>
                            <div className="text-sm text-muted-foreground truncate">/{tenant.slug}</div>
                            <div className="flex gap-2 mt-2 sm:hidden">
                              <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                                {tenant.status === "active" ? "Ativo" : "Inativo"}
                              </Badge>
                              <Badge variant="outline">{tenant.plan}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:flex-shrink-0">
                          <div className="hidden sm:flex gap-2">
                            <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                              {tenant.status === "active" ? "Ativo" : "Inativo"}
                            </Badge>
                            <Badge variant="outline">{tenant.plan}</Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyLoginUrl(tenant.slug)}
                            title="Copiar link de login"
                            data-testid={`button-copy-url-${tenant.id}`}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(tenant)}
                            title="Personalizar"
                            data-testid={`button-edit-${tenant.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700"
                                title="Excluir"
                                data-testid={`button-delete-tenant-${tenant.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Loja?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. A loja "{tenant.name}" e todos os seus dados serão removidos permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-500 hover:bg-red-600"
                                  onClick={() => deleteTenantMutation.mutate(tenant.id)}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usuarios" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h2 className="text-lg sm:text-xl font-semibold">Usuários do Sistema</h2>
              <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600" data-testid="button-add-user">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Usuário</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="user-name">Nome *</Label>
                      <Input
                        id="user-name"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        placeholder="João Silva"
                        required
                        data-testid="input-user-name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="user-cpf">CPF *</Label>
                        <Input
                          id="user-cpf"
                          value={newUser.cpf}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                            const formatted = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                            setNewUser({ ...newUser, cpf: formatted });
                          }}
                          placeholder="000.000.000-00"
                          required
                          data-testid="input-user-cpf"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="user-seller-code">Código Vendedor *</Label>
                        <Input
                          id="user-seller-code"
                          value={newUser.sellerCode}
                          onChange={(e) => setNewUser({ ...newUser, sellerCode: e.target.value.toUpperCase() })}
                          placeholder="V001"
                          required
                          data-testid="input-user-seller-code"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="user-email">Email (opcional)</Label>
                        <Input
                          id="user-email"
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          placeholder="joao@exemplo.com"
                          data-testid="input-user-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="user-phone">Telefone</Label>
                        <Input
                          id="user-phone"
                          value={newUser.phone}
                          onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                          placeholder="(11) 99999-9999"
                          data-testid="input-user-phone"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-password">Senha (deixe em branco para usar código vendedor)</Label>
                      <Input
                        id="user-password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="Deixe em branco para usar código vendedor"
                        data-testid="input-user-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Super Admin?</Label>
                      <Select 
                        value={newUser.isSuperAdmin ? "yes" : "no"} 
                        onValueChange={(value) => setNewUser({ ...newUser, isSuperAdmin: value === "yes" })}
                      >
                        <SelectTrigger data-testid="select-user-admin">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">Não</SelectItem>
                          <SelectItem value="yes">Sim</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {!newUser.isSuperAdmin && (
                      <>
                        <div className="space-y-2">
                          <Label>Vincular a uma Loja (opcional)</Label>
                          <Select 
                            value={newUser.tenantId} 
                            onValueChange={(value) => setNewUser({ ...newUser, tenantId: value })}
                          >
                            <SelectTrigger data-testid="select-user-tenant">
                              <SelectValue placeholder="Selecione uma loja" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Nenhuma</SelectItem>
                              {tenants.map((t) => (
                                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {newUser.tenantId && (
                          <div className="space-y-2">
                            <Label>Função na Loja</Label>
                            <Select 
                              value={newUser.role} 
                              onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                            >
                              <SelectTrigger data-testid="select-user-role">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="seller">Vendedor</SelectItem>
                                <SelectItem value="manager">Gerente</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    )}
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={createUserMutation.isPending}
                      data-testid="button-submit-user"
                    >
                      {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="pt-6">
                {usersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum usuário cadastrado ainda.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {users.map((u) => (
                      <div
                        key={u.id}
                        className="flex flex-col gap-4 p-4 border rounded-lg"
                        data-testid={`user-row-${u.id}`}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{u.name || u.email}</div>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 text-sm text-muted-foreground mt-1">
                              {u.cpf && (
                                <span className="flex items-center gap-1" data-testid={`user-cpf-${u.id}`}>
                                  <CreditCard className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>
                                </span>
                              )}
                              {u.sellerCode && (
                                <span className="flex items-center gap-1" data-testid={`user-seller-code-${u.id}`}>
                                  <Hash className="w-3 h-3 flex-shrink-0" />
                                  <span>{u.sellerCode}</span>
                                </span>
                              )}
                              {u.email && (
                                <span className="flex items-center gap-1 min-w-0" data-testid={`user-email-${u.id}`}>
                                  <Mail className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{u.email}</span>
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {u.isSuperAdmin && (
                                <Badge className="bg-yellow-500">Super Admin</Badge>
                              )}
                              {u.mustChangePassword && (
                                <Badge variant="outline" className="text-orange-600 border-orange-300">Primeiro acesso</Badge>
                              )}
                            </div>
                            {u.tenantUsers && u.tenantUsers.length > 0 && (
                              <div className="flex gap-1 mt-2 flex-wrap">
                                {u.tenantUsers.map((tu) => (
                                  <Badge key={tu.tenantId} variant="outline" className="text-xs">
                                    {getTenantName(tu.tenantId)} ({tu.role === "manager" ? "Gerente" : "Vendedor"})
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap border-t pt-3 sm:border-0 sm:pt-0 sm:mt-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAssignTenantDialog(u)}
                            title="Vincular a loja"
                            data-testid={`button-assign-tenant-${u.id}`}
                            className="flex-1 sm:flex-none"
                          >
                            <Link className="w-4 h-4 sm:mr-0" />
                            <span className="ml-2 sm:hidden">Vincular</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditUserDialog(u)}
                            title="Editar"
                            data-testid={`button-edit-user-${u.id}`}
                            className="flex-1 sm:flex-none"
                          >
                            <Pencil className="w-4 h-4 sm:mr-0" />
                            <span className="ml-2 sm:hidden">Editar</span>
                          </Button>
                          {u.id !== user?.id && !u.isSuperAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-blue-500 hover:text-blue-700 flex-1 sm:flex-none"
                                  title="Resetar Senha"
                                  data-testid={`button-reset-password-${u.id}`}
                                >
                                  <KeyRound className="w-4 h-4 sm:mr-0" />
                                  <span className="ml-2 sm:hidden">Resetar</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Resetar Senha?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    A senha do usuário "{u.name || u.email}" será resetada para o código de vendedor ou senha padrão.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => resetPasswordMutation.mutate(u.id)}
                                  >
                                    Resetar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {u.id !== user?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700 flex-1 sm:flex-none"
                                  title="Excluir"
                                  data-testid={`button-delete-user-${u.id}`}
                                >
                                  <Trash2 className="w-4 h-4 sm:mr-0" />
                                  <span className="ml-2 sm:hidden">Excluir</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Usuário?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O usuário "{u.name || u.email}" será removido permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-500 hover:bg-red-600"
                                    onClick={() => deleteUserMutation.mutate(u.id)}
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relatorios" className="space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold">Relatórios por Empresa</h2>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <Card className="bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border-indigo-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Clientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{tenantStats.reduce((acc, t) => acc + t.customersCount, 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1">em todas as lojas</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-600/10 to-teal-600/10 border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Pedidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{tenantStats.reduce((acc, t) => acc + t.ordersCount, 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1">em todas as lojas</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-600/10 to-red-600/10 border-orange-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Produtos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{tenantStats.reduce((acc, t) => acc + t.productsCount, 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1">em todas as lojas</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-600/10 to-cyan-600/10 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Usuários por Loja</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{tenantStats.reduce((acc, t) => acc + t.usersCount, 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1">vendedores/gerentes</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Uso por Empresa
                </CardTitle>
                <CardDescription>Estatísticas detalhadas de cada empresa cliente</CardDescription>
              </CardHeader>
              <CardContent>
                {tenantStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Nenhuma empresa cadastrada ainda.</div>
                ) : (
                  <>
                    {/* Desktop table - hidden on mobile */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 font-medium">Empresa</th>
                            <th className="text-center py-3 px-2 font-medium">Usuários</th>
                            <th className="text-center py-3 px-2 font-medium">Clientes</th>
                            <th className="text-center py-3 px-2 font-medium">Pedidos</th>
                            <th className="text-center py-3 px-2 font-medium">Produtos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tenantStats.map((stat) => (
                            <tr key={stat.tenantId} className="border-b hover:bg-muted/50" data-testid={`stat-row-${stat.tenantId}`}>
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <Store className="w-4 h-4 text-purple-600" />
                                  <span className="font-medium">{stat.tenantName}</span>
                                </div>
                              </td>
                              <td className="text-center py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Users className="w-4 h-4 text-blue-500" />
                                  <span>{stat.usersCount}</span>
                                </div>
                              </td>
                              <td className="text-center py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Users className="w-4 h-4 text-green-500" />
                                  <span>{stat.customersCount}</span>
                                </div>
                              </td>
                              <td className="text-center py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <ShoppingCart className="w-4 h-4 text-orange-500" />
                                  <span>{stat.ordersCount}</span>
                                </div>
                              </td>
                              <td className="text-center py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Package className="w-4 h-4 text-purple-500" />
                                  <span>{stat.productsCount}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/30 font-semibold">
                            <td className="py-3 px-2">Total Geral</td>
                            <td className="text-center py-3 px-2">{tenantStats.reduce((acc, t) => acc + t.usersCount, 0)}</td>
                            <td className="text-center py-3 px-2">{tenantStats.reduce((acc, t) => acc + t.customersCount, 0)}</td>
                            <td className="text-center py-3 px-2">{tenantStats.reduce((acc, t) => acc + t.ordersCount, 0)}</td>
                            <td className="text-center py-3 px-2">{tenantStats.reduce((acc, t) => acc + t.productsCount, 0)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-4">
                      {tenantStats.map((stat) => (
                        <div key={stat.tenantId} className="p-4 border rounded-lg space-y-3" data-testid={`stat-row-${stat.tenantId}`}>
                          <div className="flex items-center gap-2 font-medium">
                            <Store className="w-4 h-4 text-purple-600 flex-shrink-0" />
                            <span className="truncate">{stat.tenantName}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-blue-500" />
                              <div>
                                <div className="text-muted-foreground text-xs">Usuários</div>
                                <div className="font-medium">{stat.usersCount}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-green-500" />
                              <div>
                                <div className="text-muted-foreground text-xs">Clientes</div>
                                <div className="font-medium">{stat.customersCount}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <ShoppingCart className="w-4 h-4 text-orange-500" />
                              <div>
                                <div className="text-muted-foreground text-xs">Pedidos</div>
                                <div className="font-medium">{stat.ordersCount}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-purple-500" />
                              <div>
                                <div className="text-muted-foreground text-xs">Produtos</div>
                                <div className="font-medium">{stat.productsCount}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Total card for mobile */}
                      <div className="p-4 bg-muted/30 rounded-lg space-y-3 font-semibold">
                        <div className="font-medium">Total Geral</div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs font-normal">Usuários</div>
                            <div>{tenantStats.reduce((acc, t) => acc + t.usersCount, 0)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs font-normal">Clientes</div>
                            <div>{tenantStats.reduce((acc, t) => acc + t.customersCount, 0)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs font-normal">Pedidos</div>
                            <div>{tenantStats.reduce((acc, t) => acc + t.ordersCount, 0)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs font-normal">Produtos</div>
                            <div>{tenantStats.reduce((acc, t) => acc + t.productsCount, 0)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contatos" className="space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold">Contatos Recebidos</h2>
            <Card>
              <CardContent className="pt-6">
                {contacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Nenhum contato ainda.</div>
                ) : (
                  <div className="space-y-4">
                    {contacts.map((contact) => (
                      <div key={contact.id} className="p-4 border rounded-lg space-y-3" data-testid={`contact-row-${contact.id}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="font-medium truncate">{contact.name}</div>
                          <Badge variant={contact.status === "pending" ? "secondary" : contact.status === "replied" ? "default" : "outline"} className="self-start sm:self-auto">
                            {contact.status === "pending" ? "Pendente" : contact.status === "replied" ? "Respondido" : contact.status}
                          </Badge>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1 min-w-0">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </span>
                          {contact.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              {contact.phone}
                            </span>
                          )}
                        </div>
                        <p className="text-sm break-words">{contact.message}</p>
                        <div className="flex gap-2 pt-2 border-t sm:border-0 sm:pt-0">
                          <Button size="sm" variant="outline" onClick={() => updateContactStatusMutation.mutate({ id: contact.id, status: "replied" })} className="flex-1 sm:flex-none">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Respondido
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="demos" className="space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold">Demos Agendadas</h2>
            <Card>
              <CardContent className="pt-6">
                {demos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Nenhuma demo agendada.</div>
                ) : (
                  <div className="space-y-4">
                    {demos.map((demo) => (
                      <div key={demo.id} className="p-4 border rounded-lg space-y-3" data-testid={`demo-row-${demo.id}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="font-medium truncate">{demo.name} - {demo.company}</div>
                          <Badge variant={demo.status === "pending" ? "secondary" : demo.status === "scheduled" ? "default" : "outline"} className="self-start sm:self-auto">
                            {demo.status === "pending" ? "Pendente" : demo.status === "scheduled" ? "Agendada" : demo.status}
                          </Badge>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1 min-w-0">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{demo.email}</span>
                          </span>
                          {demo.storeCount && <span>{demo.storeCount} lojas</span>}
                        </div>
                        {demo.preferredDate && <p className="text-sm text-muted-foreground">Preferência: {formatDate(demo.preferredDate)}</p>}
                        <div className="flex gap-2 pt-2 border-t sm:border-0 sm:pt-0">
                          <Button size="sm" variant="outline" onClick={() => updateDemoStatusMutation.mutate({ id: demo.id, status: "scheduled" })} className="flex-1 sm:flex-none">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Agendar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Personalizar Loja</DialogTitle>
            </DialogHeader>
            {editingTenant && (
              <form onSubmit={handleUpdateTenant} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Loja</Label>
                  <Input
                    value={editingTenant.name}
                    onChange={(e) => setEditingTenant({ ...editingTenant, name: e.target.value })}
                    data-testid="input-edit-name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingTenant.status}
                    onValueChange={(value) => setEditingTenant({ ...editingTenant, status: value })}
                  >
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor Primária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editingTenant.primaryColor || "#9333ea"}
                        onChange={(e) => setEditingTenant({ ...editingTenant, primaryColor: e.target.value })}
                        className="w-12 h-10 p-1 cursor-pointer flex-shrink-0"
                        data-testid="input-edit-primary-color"
                      />
                      <Input
                        value={editingTenant.primaryColor || "#9333ea"}
                        onChange={(e) => setEditingTenant({ ...editingTenant, primaryColor: e.target.value })}
                        className="flex-1 min-w-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor Secundária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editingTenant.secondaryColor || "#db2777"}
                        onChange={(e) => setEditingTenant({ ...editingTenant, secondaryColor: e.target.value })}
                        className="w-12 h-10 p-1 cursor-pointer flex-shrink-0"
                        data-testid="input-edit-secondary-color"
                      />
                      <Input
                        value={editingTenant.secondaryColor || "#db2777"}
                        onChange={(e) => setEditingTenant({ ...editingTenant, secondaryColor: e.target.value })}
                        className="flex-1 min-w-0"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>URL do Logo (opcional)</Label>
                  <Input
                    value={editingTenant.logo || ""}
                    onChange={(e) => setEditingTenant({ ...editingTenant, logo: e.target.value })}
                    placeholder="https://exemplo.com/logo.png"
                    data-testid="input-edit-logo"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mensagem de Login (opcional)</Label>
                  <Textarea
                    value={editingTenant.loginMessage || ""}
                    onChange={(e) => setEditingTenant({ ...editingTenant, loginMessage: e.target.value })}
                    placeholder="Bem-vindo à nossa loja! Entre com suas credenciais."
                    rows={3}
                    data-testid="input-edit-login-message"
                  />
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Link de Login da Loja:</p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <code className="text-xs sm:text-sm flex-1 truncate min-w-0 px-2 py-1 bg-background rounded">{window.location.origin}/loja/{editingTenant.slug}</code>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLoginUrl(editingTenant.slug)}
                        className="flex-1 sm:flex-none"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/loja/${editingTenant.slug}`, "_blank")}
                        className="flex-1 sm:flex-none"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                  disabled={updateTenantMutation.isPending}
                  data-testid="button-save-tenant"
                >
                  {updateTenantMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={editingUser.name || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    data-testid="input-edit-user-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editingUser.email || ""}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    data-testid="input-edit-user-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nova Senha (deixe em branco para manter)</Label>
                  <Input
                    type="password"
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    placeholder="Nova senha"
                    data-testid="input-edit-user-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Super Admin?</Label>
                  <Select 
                    value={editingUser.isSuperAdmin ? "yes" : "no"} 
                    onValueChange={(value) => setEditingUser({ ...editingUser, isSuperAdmin: value === "yes" })}
                  >
                    <SelectTrigger data-testid="select-edit-user-admin">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">Não</SelectItem>
                      <SelectItem value="yes">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                  disabled={updateUserMutation.isPending}
                  data-testid="button-save-user"
                >
                  {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isAssignTenantDialogOpen} onOpenChange={setIsAssignTenantDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Vincular Usuário a Loja</DialogTitle>
              <DialogDescription>
                Selecione uma loja e a função para vincular {assigningUser?.name || assigningUser?.email}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignTenant} className="space-y-4">
              <div className="space-y-2">
                <Label>Loja</Label>
                <Select 
                  value={assignTenantData.tenantId} 
                  onValueChange={(value) => setAssignTenantData({ ...assignTenantData, tenantId: value })}
                >
                  <SelectTrigger data-testid="select-assign-tenant">
                    <SelectValue placeholder="Selecione uma loja" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select 
                  value={assignTenantData.role} 
                  onValueChange={(value) => setAssignTenantData({ ...assignTenantData, role: value })}
                >
                  <SelectTrigger data-testid="select-assign-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seller">Vendedor</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                disabled={assignTenantMutation.isPending || !assignTenantData.tenantId}
                data-testid="button-submit-assign"
              >
                {assignTenantMutation.isPending ? "Vinculando..." : "Vincular"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
