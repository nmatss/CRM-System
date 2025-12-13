import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Users, Pencil, Trash2, KeyRound, CreditCard, Hash, Mail, Phone } from "lucide-react";
import type { User, TenantUser } from "@shared/schema";

type UserWithoutPassword = Omit<User, "password">;

interface TeamMember extends TenantUser {
  user: UserWithoutPassword;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isManager = user?.role === "manager" || user?.isSuperAdmin;
  
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", cpf: "", sellerCode: "", phone: "", email: "", role: "seller" });

  const { data: team = [], isLoading: teamLoading } = useQuery<TeamMember[]>({
    queryKey: ["team"],
    queryFn: async () => {
      const response = await fetch("/api/team");
      if (!response.ok) throw new Error("Failed to fetch team");
      return response.json();
    },
    enabled: isManager,
  });

  const createMemberMutation = useMutation({
    mutationFn: async (data: { name: string; cpf?: string; sellerCode?: string; phone?: string; email?: string; role: string }) => {
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create member");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      setIsAddMemberDialogOpen(false);
      setNewMember({ name: "", cpf: "", sellerCode: "", phone: "", email: "", role: "seller" });
      toast({ title: "Membro adicionado!", description: "Novo membro da equipe criado com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/team/${userId}/reset-password`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Senha resetada!", description: `Nova senha temporária: ${data.temporaryPassword}` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/team/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove member");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      toast({ title: "Membro removido!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCpf = newMember.cpf.replace(/\D/g, '');
    createMemberMutation.mutate({
      name: newMember.name,
      cpf: cleanedCpf || undefined,
      sellerCode: newMember.sellerCode || undefined,
      phone: newMember.phone || undefined,
      email: newMember.email || undefined,
      role: newMember.role,
    });
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">Gerencie as preferências da sua loja e conta.</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full grid grid-cols-4 sm:flex sm:w-auto sm:justify-start border-b rounded-none bg-transparent p-0 h-auto">
            <TabsTrigger 
              value="general"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 sm:px-4 py-2 text-[10px] sm:text-sm"
            >
              Geral
            </TabsTrigger>
            <TabsTrigger 
              value="store"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 sm:px-4 py-2 text-[10px] sm:text-sm"
            >
              Loja
            </TabsTrigger>
            <TabsTrigger 
              value="notifications"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 sm:px-4 py-2 text-[10px] sm:text-sm"
            >
              <span className="hidden sm:inline">Notificações</span>
              <span className="sm:hidden">Notif.</span>
            </TabsTrigger>
            {isManager && (
              <TabsTrigger 
                value="team"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 sm:px-4 py-2 text-[10px] sm:text-sm"
              >
                Equipe
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="general" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Perfil</CardTitle>
                <CardDescription>Suas informações pessoais.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>{user?.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <Button variant="outline" className="w-full sm:w-auto">Alterar Foto</Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input id="name" defaultValue={user?.name || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" defaultValue={user?.email || ""} />
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
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Modo Escuro</Label>
                    <p className="text-sm text-muted-foreground">Alternar entre tema claro e escuro.</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>Escolha o que você quer receber.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Novos Pedidos</Label>
                    <p className="text-sm text-muted-foreground">Receba alertas quando entrar um pedido.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Alertas de Estoque</Label>
                    <p className="text-sm text-muted-foreground">Notificar quando produtos estiverem acabando.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Relatórios Semanais</Label>
                    <p className="text-sm text-muted-foreground">Resumo de performance por email.</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isManager && (
            <TabsContent value="team" className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Equipe</h2>
                  <p className="text-muted-foreground text-sm">Gerencie os vendedores da sua loja</p>
                </div>
                <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-member">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Vendedor
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
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
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="member-cpf">CPF</Label>
                          <Input
                            id="member-cpf"
                            value={newMember.cpf}
                            onChange={(e) => setNewMember({ ...newMember, cpf: formatCpf(e.target.value) })}
                            placeholder="000.000.000-00"
                            data-testid="input-member-cpf"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="member-sellerCode">Código Vendedor</Label>
                          <Input
                            id="member-sellerCode"
                            value={newMember.sellerCode}
                            onChange={(e) => setNewMember({ ...newMember, sellerCode: e.target.value })}
                            placeholder="Ex: V001"
                            data-testid="input-member-seller-code"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="member-phone">Telefone</Label>
                          <Input
                            id="member-phone"
                            value={newMember.phone}
                            onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                            placeholder="(00) 00000-0000"
                            data-testid="input-member-phone"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="member-email">Email</Label>
                          <Input
                            id="member-email"
                            type="email"
                            value={newMember.email}
                            onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                            data-testid="input-member-email"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Função</Label>
                        <Select value={newMember.role} onValueChange={(value) => setNewMember({ ...newMember, role: value })}>
                          <SelectTrigger data-testid="select-member-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="seller">Vendedor</SelectItem>
                            <SelectItem value="manager">Gerente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        A senha inicial será o código do vendedor ou "123456". O usuário deverá alterá-la no primeiro acesso.
                      </p>
                      <Button 
                        type="submit" 
                        className="w-full"
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
                <CardContent className="pt-6">
                  {teamLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                  ) : team.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum membro na equipe ainda. Adicione seu primeiro vendedor!
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {team.map((member) => (
                        <div 
                          key={member.userId} 
                          className="flex items-center justify-between p-4 border rounded-lg"
                          data-testid={`team-member-row-${member.userId}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                              <Users className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <div className="font-medium">{member.user.name}</div>
                              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                {member.user.cpf && (
                                  <span className="flex items-center gap-1">
                                    <CreditCard className="w-3 h-3" />
                                    {member.user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                  </span>
                                )}
                                {member.user.sellerCode && (
                                  <span className="flex items-center gap-1">
                                    <Hash className="w-3 h-3" />
                                    {member.user.sellerCode}
                                  </span>
                                )}
                                {member.user.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {member.user.email}
                                  </span>
                                )}
                                {member.user.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {member.user.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={member.role === "manager" ? "default" : "secondary"}>
                              {member.role === "manager" ? "Gerente" : "Vendedor"}
                            </Badge>
                            {member.user.mustChangePassword && (
                              <Badge variant="outline" className="text-orange-600 border-orange-300">Primeiro acesso</Badge>
                            )}
                            {member.userId !== user?.id && (
                              <>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-blue-500 hover:text-blue-700"
                                      title="Resetar Senha"
                                      data-testid={`button-reset-password-${member.userId}`}
                                    >
                                      <KeyRound className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Resetar Senha?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        A senha de "{member.user.name}" será resetada para o código de vendedor ou senha padrão.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => resetPasswordMutation.mutate(member.userId)}>
                                        Resetar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-red-500 hover:text-red-700"
                                      title="Remover"
                                      data-testid={`button-remove-member-${member.userId}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remover Membro?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        "{member.user.name}" será removido da equipe. Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-red-500 hover:bg-red-600"
                                        onClick={() => removeMemberMutation.mutate(member.userId)}
                                      >
                                        Remover
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
