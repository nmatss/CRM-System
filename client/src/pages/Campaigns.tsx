import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Smartphone,
  Trash2,
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
import {
  campaignStatusLabel,
  executionStatusLabel,
  formatOptionalMetric,
} from "@/lib/marketingPresentation";
import { apiRequest } from "@/lib/queryClient";
import type { Campaign } from "@shared/schema";

interface CampaignDeliveryStats {
  executions: number;
  totalRecipients: number;
  delivered: number;
  failed: number;
  skipped: number;
  pending: number;
}
interface CampaignStats {
  total: number;
  sent: number;
  draft: number;
  scheduled: number;
  failed: number;
  delivery: CampaignDeliveryStats;
  attribution: {
    available: boolean;
    reason: string;
    openRate: number | null;
    conversion: number | null;
    revenue: number | null;
  };
}
interface CampaignExecution {
  id: number;
  campaignId: number;
  status: string;
  channel: string;
  audience: string;
  totalRecipients: number;
  deliveredCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
  finishedAt: string | null;
}
interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
interface CampaignTemplate {
  id: number;
  name: string;
  channel: string;
  audience: string;
  message: string;
  channelConfigured: boolean;
}
interface CampaignFormData {
  name: string;
  channel: string;
  audience: string;
  message: string;
}

const initialFormData: CampaignFormData = {
  name: "",
  channel: "WhatsApp",
  audience: "Todos os clientes",
  message: "",
};
// Mirrors the audiences the dispatcher can resolve on the server.
const audienceOptions = [
  "Todos os clientes",
  "Clientes VIP",
  "Novos clientes",
  "Clientes inativos",
  "Aniversariantes do mês",
];

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "Email") return <Mail className="h-3.5 w-3.5" />;
  if (channel === "SMS") return <Smartphone className="h-3.5 w-3.5" />;
  return <MessageSquare className="h-3.5 w-3.5" />;
}

export default function Campaigns() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [channelFilter, setChannelFilter] = useState("all");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = hasCapability(user, capabilities.manageCampaigns);
  const campaignsQuery = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: () => fetchJson("/api/v1/campaigns"),
  });
  const statsQuery = useQuery<CampaignStats>({
    queryKey: ["campaigns", "stats"],
    queryFn: () => fetchJson("/api/v1/campaigns/stats"),
  });
  const templatesQuery = useQuery<CampaignTemplate[]>({
    queryKey: ["campaigns", "templates"],
    queryFn: () => fetchJson("/api/v1/campaigns/templates"),
  });
  const executionsQuery = useQuery<Paginated<CampaignExecution>>({
    queryKey: ["campaigns", "executions"],
    queryFn: () => fetchJson("/api/v1/campaigns/executions?limit=10"),
  });

  const sendMutation = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("POST", `/campaigns/${id}/send`, {})).json() as Promise<{
        message: string;
        execution: CampaignExecution;
      }>,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: "Envio agendado",
        description: `${result.execution.totalRecipients} destinatário(s) registrados. Acompanhe o status por destinatário na execução.`,
      });
    },
    onError: (error) =>
      toast({
        title: "Erro",
        description: actionErrorDescription(error, "Não foi possível agendar o envio."),
        variant: "destructive",
      }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingCampaign)
        return (
          await apiRequest("PUT", `/campaigns/${editingCampaign.id}`, {
            name: formData.name,
            channel: formData.channel,
            audience: formData.audience,
          })
        ).json();
      return (
        await apiRequest("POST", "/campaigns", {
          ...formData,
          status: "draft",
          scheduledAt: null,
          sent: 0,
          openRate: 0,
          conversion: 0,
          revenue: 0,
        })
      ).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: editingCampaign ? "Campanha atualizada" : "Rascunho criado",
        description: editingCampaign
          ? "A configuração foi atualizada."
          : "A campanha foi salva como rascunho; nenhuma mensagem foi enviada.",
      });
      closeDialog();
    },
    onError: (error) =>
      toast({
        title: "Erro",
        description: actionErrorDescription(error, "Não foi possível salvar a campanha."),
        variant: "destructive",
      }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/campaigns/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campanha excluída" });
    },
    onError: (error) =>
      toast({
        title: "Erro",
        description: actionErrorDescription(error, "Não foi possível excluir a campanha."),
        variant: "destructive",
      }),
  });

  const filteredCampaigns = useMemo(
    () =>
      channelFilter === "all"
        ? (campaignsQuery.data ?? [])
        : (campaignsQuery.data ?? []).filter((item) => item.channel === channelFilter),
    [campaignsQuery.data, channelFilter],
  );
  function openCreate(template?: CampaignTemplate) {
    setEditingCampaign(null);
    setFormData(
      template
        ? {
            name: template.name,
            channel: template.channel,
            audience: template.audience,
            message: template.message,
          }
        : initialFormData,
    );
    setDialogOpen(true);
  }
  function openEdit(campaign: Campaign) {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      channel: campaign.channel,
      audience: campaign.audience,
      message: campaign.message ?? "",
    });
    setDialogOpen(true);
  }
  function closeDialog() {
    setDialogOpen(false);
    setEditingCampaign(null);
    setFormData(initialFormData);
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Campanhas de Marketing</h1>
            <p className="text-sm text-muted-foreground">
              Configure rascunhos e dispare envios pela outbox durável. Cada destinatário tem status
              próprio e nada é contado como entregue sem confirmação do provedor.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => openCreate()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo rascunho
            </Button>
          )}
        </div>
        {statsQuery.isLoading ? (
          <Loading />
        ) : statsQuery.isError ? (
          <ErrorState
            text="Não foi possível carregar as estatísticas."
            retry={() => statsQuery.refetch()}
          />
        ) : (
          statsQuery.data && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                title="Campanhas"
                value={String(statsQuery.data.total)}
                subtitle={`${statsQuery.data.draft} rascunho(s) · ${statsQuery.data.scheduled} agendada(s)`}
              />
              <Metric
                title="Entregas confirmadas"
                value={String(statsQuery.data.delivery.delivered)}
                subtitle={`de ${statsQuery.data.delivery.totalRecipients} destinatário(s) processados`}
              />
              <Metric
                title="Falhas e canais sem provedor"
                value={String(statsQuery.data.delivery.failed)}
                subtitle={`${statsQuery.data.delivery.skipped} ignorado(s) por opt-out`}
              />
              <Metric
                title="Taxa de abertura"
                value={formatOptionalMetric(statsQuery.data.attribution.openRate, "%")}
                subtitle={
                  statsQuery.data.attribution.available
                    ? "Baseada em eventos de atribuição"
                    : "Sem eventos de atribuição coletados"
                }
              />
            </div>
          )
        )}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Campanhas configuradas</CardTitle>
                <CardDescription>
                  Nenhum status nesta tela confirma entrega por um provedor externo.
                </CardDescription>
              </div>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os canais</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {campaignsQuery.isLoading ? (
              <Loading />
            ) : campaignsQuery.isError ? (
              <ErrorState
                text="Não foi possível carregar as campanhas."
                retry={() => campaignsQuery.refetch()}
              />
            ) : filteredCampaigns.length === 0 ? (
              <Empty text="Nenhuma campanha configurada." />
            ) : (
              <div className="space-y-3">
                {filteredCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{campaign.name}</p>
                        <Badge variant="outline" className="gap-1">
                          <ChannelIcon channel={campaign.channel} />
                          {campaign.channel}
                        </Badge>
                        <Badge variant="secondary">{campaignStatusLabel(campaign.status)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Audiência configurada: {campaign.audience}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Entregas confirmadas: {campaign.sent} · Abertura e conversão: indisponíveis
                        até existir evento de atribuição
                      </p>
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
                          <DropdownMenuItem onClick={() => openEdit(campaign)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar configuração
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={sendMutation.isPending}
                            onClick={() => sendMutation.mutate(campaign.id)}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Agendar envio
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(campaign.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Execuções recentes</CardTitle>
            <CardDescription>
              Cada execução guarda o status individual de cada destinatário.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {executionsQuery.isLoading ? (
              <Loading />
            ) : executionsQuery.isError ? (
              <ErrorState
                text="Não foi possível carregar as execuções."
                retry={() => executionsQuery.refetch()}
              />
            ) : !executionsQuery.data?.data.length ? (
              <Empty text="Nenhum envio foi disparado ainda." />
            ) : (
              <div className="space-y-3">
                {executionsQuery.data.data.map((execution) => (
                  <div
                    key={execution.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">Execução #{execution.id}</p>
                        <Badge variant="secondary">{executionStatusLabel(execution.status)}</Badge>
                        <Badge variant="outline">{execution.channel}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {execution.audience} · {execution.totalRecipients} destinatário(s)
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {execution.deliveredCount} entregue(s) · {execution.failedCount} falha(s) ·{" "}
                      {execution.skippedCount} ignorado(s)
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Templates disponíveis</CardTitle>
            <CardDescription>
              Templates fornecidos pela API; usá-los apenas preenche um novo rascunho.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {templatesQuery.isLoading ? (
              <Loading />
            ) : templatesQuery.isError ? (
              <ErrorState
                text="Não foi possível carregar os templates."
                retry={() => templatesQuery.refetch()}
              />
            ) : !templatesQuery.data?.length ? (
              <Empty text="Nenhum template disponível." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templatesQuery.data.map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription>
                        {template.channel} · {template.audience}
                        {template.channelConfigured ? "" : " · canal sem provedor configurado"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
                        {template.message}
                      </p>
                      {canManage && (
                        <Button
                          className="mt-4 w-full"
                          variant="outline"
                          onClick={() => openCreate(template)}
                        >
                          Usar no rascunho
                        </Button>
                      )}
                    </CardContent>
                  </Card>
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
            <DialogTitle>{editingCampaign ? "Editar configuração" : "Novo rascunho"}</DialogTitle>
            <DialogDescription>
              {editingCampaign
                ? "O backend atual permite alterar nome, canal e audiência; a mensagem existente é somente leitura."
                : "Salvar cria somente um rascunho. Nenhum envio será disparado."}
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
              <Label htmlFor="campaign-name">Nome</Label>
              <Input
                id="campaign-name"
                required
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select
                  value={formData.channel}
                  onValueChange={(channel) => setFormData({ ...formData, channel })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Audiência</Label>
                <Select
                  value={formData.audience}
                  onValueChange={(audience) => setFormData({ ...formData, audience })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {audienceOptions.map((audience) => (
                      <SelectItem key={audience} value={audience}>
                        {audience}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-message">Mensagem</Label>
              <Textarea
                id="campaign-message"
                rows={7}
                value={formData.message}
                readOnly={Boolean(editingCampaign)}
                onChange={(event) => setFormData({ ...formData, message: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {editingCampaign
                  ? "A rota de atualização ainda não aceita o campo mensagem."
                  : "Variáveis de template permanecem como texto; não há resolução nem envio nesta etapa."}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingCampaign ? "Salvar configuração" : "Salvar rascunho"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function Metric({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
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
