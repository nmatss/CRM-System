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
  Pause,
  Pencil,
  Play,
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
import { automationExecutionStatusLabel } from "@/lib/marketingPresentation";
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

const triggerLabels: Record<string, string> = {
  "customer.created": "Quando um cliente é cadastrado",
  "order.created": "Quando um pedido é criado",
};
const actionLabels: Record<string, string> = {
  notify_customer: "Notificar o cliente",
};
const channelLabels: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

interface AutomationCapabilities {
  triggers: string[];
  actions: string[];
  channels: string[];
  /** Channels that actually have a provider configured on the server. */
  configuredChannels: string[];
  audiences: string[];
}
interface AutomationExecution {
  id: number;
  automationId: number;
  automationTitle: string;
  automationVersion: number;
  triggerType: string;
  triggerReference: string | null;
  status: string;
  attempts: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}
interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface AutomationFormData {
  title: string;
  description: string;
  icon: string;
  triggerType: string;
  actionType: string;
  actionChannel: string;
}

const initialFormData: AutomationFormData = {
  title: "",
  description: "",
  icon: "Zap",
  triggerType: "customer.created",
  actionType: "notify_customer",
  actionChannel: "email",
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
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
    queryFn: () => fetchJson("/api/v1/automations"),
  });
  const capabilitiesQuery = useQuery<AutomationCapabilities>({
    queryKey: ["automations", "capabilities"],
    queryFn: () => fetchJson("/api/v1/automations/capabilities"),
  });
  const historyQuery = useQuery<Paginated<AutomationExecution>>({
    queryKey: ["automations", "history"],
    queryFn: () => fetchJson("/api/v1/automations/history?limit=20"),
  });

  const configuredChannels = capabilitiesQuery.data?.configuredChannels ?? [];
  const availableTriggers = capabilitiesQuery.data?.triggers ?? Object.keys(triggerLabels);
  const availableActions = capabilitiesQuery.data?.actions ?? Object.keys(actionLabels);
  const availableChannels = capabilitiesQuery.data?.channels ?? Object.keys(channelLabels);

  function invalidateAutomations() {
    queryClient.invalidateQueries({ queryKey: ["automations"] });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = editingAutomation ? formData : { ...formData, isActive: false, stats: null };
      const response = editingAutomation
        ? await apiRequest("PUT", `/automations/${editingAutomation.id}`, payload)
        : await apiRequest("POST", "/automations", payload);
      return response.json();
    },
    onSuccess: () => {
      invalidateAutomations();
      toast({
        title: editingAutomation ? "Automação atualizada" : "Automação criada",
        description: editingAutomation
          ? "Alterar gatilho, ação ou canal cria uma nova versão da definição."
          : "A automação foi salva pausada. Ative-a quando quiser que ela execute.",
      });
      closeDialog();
    },
    onError: (error) =>
      toast({
        title: "Erro",
        description: actionErrorDescription(error, "Não foi possível salvar a automação."),
        variant: "destructive",
      }),
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/automations/${id}/toggle`, {})).json() as Promise<Automation>,
    onSuccess: (automation) => {
      invalidateAutomations();
      toast({
        title: automation.isActive ? "Automação ativada" : "Automação pausada",
        description: automation.isActive
          ? "Novos eventos passam a gerar execuções."
          : "Nenhuma nova execução será agendada.",
      });
    },
    onError: (error) =>
      toast({
        title: "Erro",
        description: actionErrorDescription(error, "Não foi possível alterar o estado."),
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/automations/${id}`)).json(),
    onSuccess: () => {
      invalidateAutomations();
      toast({ title: "Automação excluída" });
    },
    onError: (error) =>
      toast({
        title: "Erro",
        description: actionErrorDescription(error, "Não foi possível excluir a automação."),
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
      triggerType: automation.triggerType,
      actionType: automation.actionType,
      actionChannel: automation.actionChannel,
    });
    setDialogOpen(true);
  }
  function closeDialog() {
    setDialogOpen(false);
    setEditingAutomation(null);
    setFormData(initialFormData);
  }

  const automations = automationsQuery.data ?? [];
  const activeCount = automations.filter((automation) => automation.isActive).length;
  const selectedChannelConfigured = configuredChannels.includes(formData.actionChannel);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Automações</h1>
            <p className="text-sm text-muted-foreground">
              Cada evento suportado gera uma execução registrada e idempotente. Só gatilhos, ações e
              canais que o servidor executa podem ser configurados.
            </p>
          </div>
          {canManage && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nova automação
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Automações ativas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{automationsQuery.isLoading ? "—" : activeCount}</p>
              <p className="text-xs text-muted-foreground">de {automations.length} cadastradas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Execuções registradas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {historyQuery.isLoading ? "—" : (historyQuery.data?.pagination.total ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Histórico auditável no banco</p>
            </CardContent>
          </Card>
          <Card className={configuredChannels.length === 0 ? "border-amber-300" : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Canais com provedor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">
                {capabilitiesQuery.isLoading
                  ? "—"
                  : configuredChannels.length === 0
                    ? "Nenhum configurado"
                    : configuredChannels.map((c) => channelLabels[c] ?? c).join(", ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Sem provedor, a execução é registrada como falha e nada é enviado.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Definições cadastradas</CardTitle>
            <CardDescription>
              Alterar gatilho, ação ou canal cria uma nova versão; execuções pendentes da versão
              anterior são ignoradas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {automationsQuery.isLoading ? (
              <Loading />
            ) : automationsQuery.isError ? (
              <ErrorState
                text="Não foi possível carregar as automações."
                retry={() => automationsQuery.refetch()}
              />
            ) : automations.length === 0 ? (
              <Empty text="Nenhuma automação cadastrada." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {automations.map((automation) => {
                  const Icon = iconMap[automation.icon] ?? Zap;
                  const channelReady = configuredChannels.includes(automation.actionChannel);
                  return (
                    <Card key={automation.id}>
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className="rounded-md bg-muted p-2">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base">{automation.title}</CardTitle>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant={automation.isActive ? "default" : "outline"}>
                                {automation.isActive ? "Ativa" : "Pausada"}
                              </Badge>
                              <Badge variant="secondary">v{automation.version}</Badge>
                              {!channelReady && <Badge variant="outline">Canal sem provedor</Badge>}
                            </div>
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
                                  disabled={toggleMutation.isPending}
                                  onClick={() => toggleMutation.mutate(automation.id)}
                                >
                                  {automation.isActive ? (
                                    <Pause className="mr-2 h-4 w-4" />
                                  ) : (
                                    <Play className="mr-2 h-4 w-4" />
                                  )}
                                  {automation.isActive ? "Pausar" : "Ativar"}
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
                      <CardContent className="space-y-2">
                        <p className="text-sm text-muted-foreground">{automation.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {triggerLabels[automation.triggerType] ?? automation.triggerType} →{" "}
                          {actionLabels[automation.actionType] ?? automation.actionType} via{" "}
                          {channelLabels[automation.actionChannel] ?? automation.actionChannel}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de execuções</CardTitle>
            <CardDescription>
              Registros reais da tabela de execuções, incluindo tentativas e motivo da falha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyQuery.isLoading ? (
              <Loading />
            ) : historyQuery.isError ? (
              <ErrorState
                text="Não foi possível carregar o histórico."
                retry={() => historyQuery.refetch()}
              />
            ) : !historyQuery.data?.data.length ? (
              <Empty text="Nenhuma execução registrada até agora." />
            ) : (
              <div className="space-y-3">
                {historyQuery.data.data.map((execution) => (
                  <div
                    key={execution.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{execution.automationTitle}</p>
                        <Badge variant="secondary">
                          {automationExecutionStatusLabel(execution.status)}
                        </Badge>
                        <Badge variant="outline">v{execution.automationVersion}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {triggerLabels[execution.triggerType] ?? execution.triggerType}
                        {execution.triggerReference
                          ? ` · #${execution.triggerReference}`
                          : ""} · {execution.attempts} tentativa(s)
                      </p>
                      {execution.error && (
                        <p className="mt-1 text-xs text-destructive">{execution.error}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {execution.finishedAt ?? execution.createdAt}
                    </p>
                  </div>
                ))}
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
            <DialogTitle>{editingAutomation ? "Editar automação" : "Nova automação"}</DialogTitle>
            <DialogDescription>
              {editingAutomation
                ? "Alterar gatilho, ação ou canal gera uma nova versão da definição."
                : "A automação é criada pausada. Ative-a quando quiser que ela execute."}
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
              <Label htmlFor="automation-description">Descrição</Label>
              <Textarea
                id="automation-description"
                required
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Gatilho</Label>
              <Select
                value={formData.triggerType}
                onValueChange={(triggerType) => setFormData({ ...formData, triggerType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTriggers.map((trigger) => (
                    <SelectItem key={trigger} value={trigger}>
                      {triggerLabels[trigger] ?? trigger}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ação</Label>
                <Select
                  value={formData.actionType}
                  onValueChange={(actionType) => setFormData({ ...formData, actionType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableActions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {actionLabels[action] ?? action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select
                  value={formData.actionChannel}
                  onValueChange={(actionChannel) => setFormData({ ...formData, actionChannel })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChannels.map((channel) => (
                      <SelectItem key={channel} value={channel}>
                        {channelLabels[channel] ?? channel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!selectedChannelConfigured && (
              <p className="text-xs text-amber-700">
                Este canal ainda não tem provedor configurado no servidor. A automação será
                registrada, mas cada execução terminará como falha sem enviar nada.
              </p>
            )}
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
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingAutomation ? "Salvar alterações" : "Criar pausada"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function Loading() {
  return (
    <div className="flex min-h-32 items-center justify-center" role="status">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="sr-only">Carregando</span>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>;
}
function ErrorState({ text, retry }: { text: string; retry: () => void }) {
  return (
    <div
      className="flex min-h-32 flex-col items-center justify-center gap-3 text-center"
      role="alert"
    >
      <AlertCircle className="h-6 w-6 text-destructive" />
      <p className="text-sm text-destructive">{text}</p>
      <Button variant="outline" size="sm" onClick={retry}>
        Tentar novamente
      </Button>
    </div>
  );
}
