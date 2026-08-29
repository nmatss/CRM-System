import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Clock,
  DollarSign,
  Gift,
  Heart,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  UserCheck,
  Zap,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { actionErrorDescription } from "@/lib/actionErrors";
import { capabilities, hasCapability } from "@/lib/capabilities";
import { apiRequest } from "@/lib/queryClient";
import type { Automation } from "@shared/schema";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  UserCheck,
  Gift,
  Clock,
  Zap,
  Mail,
  MessageSquare,
  AlertCircle,
  DollarSign,
  Heart,
};
const iconOptions = Object.keys(iconMap);
interface AutomationFormData {
  title: string;
  description: string;
  icon: string;
}
const initialFormData: AutomationFormData = { title: "", description: "", icon: "Zap" };

async function fetchAutomations(): Promise<Automation[]> {
  const response = await fetch("/api/v1/automations", { credentials: "include" });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
}

export default function Automations() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = hasCapability(user, capabilities.manageAutomations);
  const automationsQuery = useQuery<Automation[]>({
    queryKey: ["automations"],
    queryFn: fetchAutomations,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...formData, isActive: false, stats: null };
      const response = editingAutomation
        ? await apiRequest("PUT", `/automations/${editingAutomation.id}`, payload)
        : await apiRequest("POST", "/automations", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: editingAutomation ? "Configuração atualizada" : "Configuração criada",
        description:
          "A automação permanece inativa; o motor de execução ainda não está implementado.",
      });
      closeDialog();
    },
    onError: (error) =>
      toast({
        title: "Erro",
        description: actionErrorDescription(error, "Não foi possível salvar a configuração."),
        variant: "destructive",
      }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/automations/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: "Configuração excluída" });
    },
    onError: (error) =>
      toast({
        title: "Erro",
        description: actionErrorDescription(error, "Não foi possível excluir a configuração."),
        variant: "destructive",
      }),
  });

  function openCreate() {
    setEditingAutomation(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  }
  function openEdit(automation: Automation) {
    setEditingAutomation(automation);
    setFormData({
      title: automation.title,
      description: automation.description,
      icon: automation.icon,
    });
    setDialogOpen(true);
  }
  function closeDialog() {
    setDialogOpen(false);
    setEditingAutomation(null);
    setFormData(initialFormData);
  }
  const automations = automationsQuery.data ?? [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Configurações de automação</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre definições para uso futuro. Não há motor, fila, provedor nem histórico de
              execução ativo.
            </p>
          </div>
          {canManage && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nova configuração
            </Button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Configurações cadastradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {automationsQuery.isLoading ? "—" : automations.length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-amber-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-700">Execução automática</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">Indisponível</p>
              <p className="text-xs text-muted-foreground">
                Ativação e métricas serão liberadas somente após existir motor auditável.
              </p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Definições cadastradas</CardTitle>
            <CardDescription>
              O estado persistido é exibido apenas como dado legado e não comprova execução.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {automationsQuery.isLoading ? (
              <div className="flex min-h-48 items-center justify-center" role="status">
                <Loader2 className="h-7 w-7 animate-spin" />
                <span className="sr-only">Carregando</span>
              </div>
            ) : automationsQuery.isError ? (
              <div
                className="flex min-h-48 flex-col items-center justify-center gap-3"
                role="alert"
              >
                <AlertCircle className="h-7 w-7 text-destructive" />
                <p className="text-sm text-destructive">
                  Não foi possível carregar as configurações.
                </p>
                <Button variant="outline" size="sm" onClick={() => automationsQuery.refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : automations.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Nenhuma configuração cadastrada.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {automations.map((automation) => {
                  const Icon = iconMap[automation.icon] ?? Zap;
                  return (
                    <Card key={automation.id}>
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className="rounded-md bg-muted p-2">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base">{automation.title}</CardTitle>
                            <Badge variant="outline" className="mt-2">
                              {automation.isActive
                                ? "Marcada ativa — motor indisponível"
                                : "Configuração inativa"}
                            </Badge>
                          </div>
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Ações</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(automation)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => deleteMutation.mutate(automation.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{automation.description}</p>
                        <Button
                          className="mt-4"
                          variant="outline"
                          disabled
                          title="O motor de automações ainda não foi implementado"
                        >
                          Executar agora — indisponível
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAutomation ? "Editar configuração" : "Nova configuração"}
            </DialogTitle>
            <DialogDescription>
              A definição será salva inativa e não executará mensagens ou tarefas.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="automation-title">Nome</Label>
              <Input
                id="automation-title"
                required
                value={formData.title}
                onChange={(event) => setFormData({ ...formData, title: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="automation-description">Descrição da configuração</Label>
              <Textarea
                id="automation-description"
                required
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select
                value={formData.icon}
                onValueChange={(icon) => setFormData({ ...formData, icon })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
                inativa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
