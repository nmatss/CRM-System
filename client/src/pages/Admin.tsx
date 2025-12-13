import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Plus, Users, Store, Crown, Pencil, Copy, ExternalLink, MessageSquare, Calendar, Mail, Phone, Clock, CheckCircle2, XCircle } from "lucide-react";
import type { Tenant, ContactRequest, DemoRequest } from "@shared/schema";

export default function Admin() {
  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: "", slug: "", plan: "free" });
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["admin", "tenants"],
    queryFn: async () => {
      const response = await fetch("/api/admin/tenants");
      if (!response.ok) throw new Error("Failed to fetch tenants");
      return response.json();
    },
    enabled: isSuperAdmin,
  });

  const { data: contacts = [] } = useQuery<ContactRequest[]>({
    queryKey: ["admin", "contacts"],
    queryFn: async () => {
      const response = await fetch("/api/admin/contacts");
      if (!response.ok) throw new Error("Failed to fetch contacts");
      return response.json();
    },
    enabled: isSuperAdmin,
  });

  const { data: demos = [] } = useQuery<DemoRequest[]>({
    queryKey: ["admin", "demos"],
    queryFn: async () => {
      const response = await fetch("/api/admin/demos");
      if (!response.ok) throw new Error("Failed to fetch demos");
      return response.json();
    },
    enabled: isSuperAdmin,
  });

  const updateContactStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/admin/contacts/${id}/status`, {
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
      const response = await fetch(`/api/admin/demos/${id}/status`, {
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
      const response = await fetch("/api/admin/tenants", {
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
      const response = await fetch(`/api/admin/tenants/${data.id}`, {
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

  const openEditDialog = (tenant: Tenant) => {
    setEditingTenant({ ...tenant });
    setIsEditDialogOpen(true);
  };

  const copyLoginUrl = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/loja/${slug}`);
    toast({ title: "Link copiado!", description: "URL de login copiada para a área de transferência." });
  };

  if (!isSuperAdmin) {
    return (
      <Layout>
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
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="admin-title">Painel Admin</h1>
            <p className="text-muted-foreground">Gerencie lojas e usuários do sistema</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600" data-testid="button-add-tenant">
                <Plus className="w-4 h-4 mr-2" />
                Nova Loja
              </Button>
            </DialogTrigger>
            <DialogContent>
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Seu Usuário</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium" data-testid="stat-user-email">{user?.email}</div>
              <Badge variant="secondary" className="mt-1">Super Admin</Badge>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lojas Cadastradas</CardTitle>
            <CardDescription>Lista de todas as lojas no sistema</CardDescription>
          </CardHeader>
          <CardContent>
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
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`tenant-row-${tenant.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                        <Store className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-medium">{tenant.name}</div>
                        <div className="text-sm text-muted-foreground">/{tenant.slug}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                        {tenant.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                      <Badge variant="outline">{tenant.plan}</Badge>
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Contatos Recentes
              </CardTitle>
              <CardDescription>Mensagens recebidas pelo formulário de contato</CardDescription>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhum contato ainda.</div>
              ) : (
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {contacts.slice(0, 10).map((contact) => (
                    <div key={contact.id} className="p-4 border rounded-lg space-y-2" data-testid={`contact-row-${contact.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{contact.name}</div>
                        <Badge variant={contact.status === "pending" ? "secondary" : contact.status === "replied" ? "default" : "outline"}>
                          {contact.status === "pending" ? "Pendente" : contact.status === "replied" ? "Respondido" : contact.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {contact.email}</span>
                        {contact.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone}</span>}
                      </div>
                      <p className="text-sm">{contact.message}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateContactStatusMutation.mutate({ id: contact.id, status: "replied" })}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Respondido
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Demos Agendadas
              </CardTitle>
              <CardDescription>Solicitações de demonstração</CardDescription>
            </CardHeader>
            <CardContent>
              {demos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhuma demo agendada.</div>
              ) : (
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {demos.slice(0, 10).map((demo) => (
                    <div key={demo.id} className="p-4 border rounded-lg space-y-2" data-testid={`demo-row-${demo.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{demo.name} - {demo.company}</div>
                        <Badge variant={demo.status === "pending" ? "secondary" : demo.status === "scheduled" ? "default" : "outline"}>
                          {demo.status === "pending" ? "Pendente" : demo.status === "scheduled" ? "Agendada" : demo.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {demo.email}</span>
                        {demo.storeCount && <span>{demo.storeCount} lojas</span>}
                      </div>
                      {demo.preferredDate && <p className="text-sm text-muted-foreground">Preferência: {demo.preferredDate}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateDemoStatusMutation.mutate({ id: demo.id, status: "scheduled" })}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Agendar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg">
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor Primária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editingTenant.primaryColor || "#9333ea"}
                        onChange={(e) => setEditingTenant({ ...editingTenant, primaryColor: e.target.value })}
                        className="w-12 h-10 p-1 cursor-pointer"
                        data-testid="input-edit-primary-color"
                      />
                      <Input
                        value={editingTenant.primaryColor || "#9333ea"}
                        onChange={(e) => setEditingTenant({ ...editingTenant, primaryColor: e.target.value })}
                        className="flex-1"
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
                        className="w-12 h-10 p-1 cursor-pointer"
                        data-testid="input-edit-secondary-color"
                      />
                      <Input
                        value={editingTenant.secondaryColor || "#db2777"}
                        onChange={(e) => setEditingTenant({ ...editingTenant, secondaryColor: e.target.value })}
                        className="flex-1"
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
                  <p className="text-sm text-muted-foreground mb-1">Link de Login da Loja:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm flex-1 truncate">{window.location.origin}/loja/{editingTenant.slug}</code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyLoginUrl(editingTenant.slug)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`/loja/${editingTenant.slug}`, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
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
      </div>
    </Layout>
  );
}
