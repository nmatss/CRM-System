import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import { 
  MessageSquare, 
  Mail, 
  Smartphone, 
  Send,
  Calendar,
  Plus,
  Loader2,
  Eye,
  Sparkles,
  Users,
  MoreHorizontal,
  Pencil,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Campaign, Customer } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CampaignFormData {
  name: string;
  channel: string;
  audience: string;
  message: string;
  status: string;
  scheduledAt: string;
}

const formatDate = (date: Date | string | null): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
};

const formatDateForInput = (date: Date | string | null): string => {
  if (!date) return new Date().toISOString().split('T')[0];
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split('T')[0];
};

const initialFormData: CampaignFormData = {
  name: "",
  channel: "WhatsApp",
  audience: "Todos os clientes",
  message: "",
  status: "Rascunho",
  scheduledAt: new Date().toISOString().split('T')[0],
};

const messageTemplates = {
  WhatsApp: [
    {
      name: "Boas-vindas",
      content: "Olá {{nome}}! 👋\n\nSeja bem-vindo(a) à nossa loja! Estamos muito felizes em tê-lo(a) conosco.\n\nConheça nossas novidades e aproveite 10% de desconto na primeira compra com o cupom BEMVINDO10! 🎁",
    },
    {
      name: "Aniversário",
      content: "Parabéns, {{nome}}! 🎂🎉\n\nHoje é seu dia especial e preparamos um presente para você: 20% de desconto em toda a loja!\n\nUse o cupom NIVER20 e celebre com estilo! 🛍️",
    },
    {
      name: "Promoção",
      content: "{{nome}}, você não pode perder! 🔥\n\nNossa coleção {{categoria}} está com até 50% OFF!\n\nCorra, são poucas peças! 🏃‍♀️",
    },
    {
      name: "Reativação",
      content: "Oi {{nome}}, sentimos sua falta! 💕\n\nFaz tempo que você não nos visita. Que tal conferir as novidades?\n\nPreparamos um cupom especial de 15% de desconto para você: VOLTEI15 🎁",
    },
  ],
  SMS: [
    {
      name: "Promoção curta",
      content: "{{nome}}, 50% OFF em toda loja! Use cupom PROMO50. Válido até domingo!",
    },
    {
      name: "Lembrete",
      content: "Oi {{nome}}! Seu pedido está pronto para retirada. Aguardamos você!",
    },
    {
      name: "Aniversário",
      content: "Feliz aniversário {{nome}}! 🎂 Ganhe 20% OFF com cupom NIVER20!",
    },
  ],
  Email: [
    {
      name: "Newsletter",
      content: "Olá {{nome}},\n\nConfira as novidades da semana!\n\nNossa coleção {{categoria}} chegou com peças exclusivas que combinam perfeitamente com seu estilo.\n\nAproveite frete grátis em compras acima de R$ 299!\n\nAbraços,\nEquipe da Loja",
    },
    {
      name: "Abandono de carrinho",
      content: "Oi {{nome}},\n\nVimos que você deixou alguns itens no carrinho. 🛒\n\nNão deixe escapar! Complete sua compra agora e garanta suas peças favoritas.\n\nCaso tenha alguma dúvida, estamos à disposição.\n\nAbraços!",
    },
  ],
};

const audienceOptions = [
  { value: "Todos os clientes", label: "Todos os clientes", icon: Users },
  { value: "Clientes VIP", label: "Clientes VIP", icon: Sparkles },
  { value: "Novos clientes", label: "Novos clientes (últimos 30 dias)", icon: Users },
  { value: "Clientes inativos", label: "Clientes inativos (+90 dias)", icon: Users },
  { value: "Aniversariantes do mês", label: "Aniversariantes do mês", icon: Calendar },
];

export default function Campaigns() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>(initialFormData);
  const [previewCustomer, setPreviewCustomer] = useState({ nome: "Maria Silva", categoria: "Vestidos" });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/campaigns");
      if (!response.ok) throw new Error("Erro ao carregar campanhas");
      return response.json();
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Campaign>) => {
      const response = await apiRequest("POST", "/api/campaigns", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Sucesso!", description: "Campanha criada com sucesso." });
      closeModal();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível criar a campanha.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Campaign> }) => {
      const response = await apiRequest("PUT", `/api/campaigns/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Sucesso!", description: "Campanha atualizada com sucesso." });
      closeModal();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível atualizar a campanha.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/campaigns/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Sucesso!", description: "Campanha excluída com sucesso." });
      setIsDeleteDialogOpen(false);
      setCampaignToDelete(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível excluir a campanha.", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/campaigns/${id}/send`, {});
      return response.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campanha enviada!", description: "As mensagens estão sendo processadas." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível enviar a campanha.", variant: "destructive" });
    },
  });

  const openCreateModal = () => {
    setEditingCampaign(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      channel: campaign.channel,
      audience: campaign.audience,
      message: campaign.message || "",
      status: campaign.status,
      scheduledAt: formatDateForInput(campaign.scheduledAt),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCampaign(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const campaignData = {
      name: formData.name,
      channel: formData.channel,
      audience: formData.audience,
      message: formData.message || null,
      status: formData.status,
      scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : null,
      sent: 0,
      openRate: 0,
      conversion: 0,
      revenue: 0,
    };

    if (editingCampaign) {
      updateMutation.mutate({ id: editingCampaign.id, data: campaignData });
    } else {
      createMutation.mutate(campaignData);
    }
  };

  const handleSendCampaign = (campaign: Campaign) => {
    sendMutation.mutate(campaign.id);
  };

  const openDeleteDialog = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (campaignToDelete) {
      deleteMutation.mutate(campaignToDelete.id);
    }
  };

  const applyTemplate = (template: { name: string; content: string }) => {
    setFormData({ ...formData, message: template.content });
  };

  const getPreviewMessage = () => {
    return formData.message
      .replace(/\{\{nome\}\}/g, previewCustomer.nome)
      .replace(/\{\{categoria\}\}/g, previewCustomer.categoria);
  };

  const filterCampaigns = (channel?: string) => {
    if (!channel) return campaigns;
    return campaigns.filter(c => c.channel === channel);
  };

  const getAudienceCount = (audience: string): number => {
    switch (audience) {
      case "Todos os clientes":
        return customers.length;
      case "Clientes VIP":
        return customers.filter(c => c.segment === "VIP").length;
      case "Novos clientes":
        return customers.filter(c => c.segment === "Novo").length;
      case "Clientes inativos":
        return customers.filter(c => c.segment === "Inativo" || c.segment === "Em Risco").length;
      case "Aniversariantes do mês":
        const currentMonth = new Date().getMonth() + 1;
        return customers.filter(c => {
          if (!c.birthDate) return false;
          const [day, month] = c.birthDate.split('/');
          return parseInt(month) === currentMonth;
        }).length;
      default:
        return 0;
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const renderCampaignList = (filteredCampaigns: Campaign[]) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (filteredCampaigns.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Send className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">Nenhuma campanha encontrada.</p>
          <Button variant="outline" onClick={openCreateModal} data-testid="button-create-first">
            Criar primeira campanha
          </Button>
        </div>
      );
    }

    return (
      <div className="grid gap-6">
        {filteredCampaigns.map((campaign) => (
          <Card key={campaign.id} className="overflow-hidden" data-testid={`card-campaign-${campaign.id}`}>
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`
                      p-3 rounded-lg 
                      ${campaign.channel === 'WhatsApp' ? 'bg-green-100 text-green-600' : 
                        campaign.channel === 'SMS' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}
                    `}>
                      {campaign.channel === 'WhatsApp' ? <MessageSquare className="h-6 w-6" /> : 
                       campaign.channel === 'SMS' ? <Smartphone className="h-6 w-6" /> : <Mail className="h-6 w-6" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg" data-testid={`text-name-${campaign.id}`}>{campaign.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Badge variant="outline" className="font-normal" data-testid={`badge-audience-${campaign.id}`}>
                          {campaign.audience}
                        </Badge>
                        <span>•</span>
                        <span data-testid={`text-date-${campaign.id}`}>{formatDate(campaign.scheduledAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={campaign.status === "Ativo" ? "default" : campaign.status === "Concluído" ? "secondary" : "outline"}
                      data-testid={`badge-status-${campaign.id}`}
                    >
                      {campaign.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${campaign.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditModal(campaign)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {campaign.status === "Rascunho" && (
                          <DropdownMenuItem onClick={() => handleSendCampaign(campaign)}>
                            <Send className="h-4 w-4 mr-2" />
                            Enviar agora
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => openDeleteDialog(campaign)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/30 p-4 sm:p-6 grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-8 border-t md:border-t-0 md:border-l md:min-w-[350px]">
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Enviados</p>
                  <p className="text-sm sm:text-xl font-bold" data-testid={`text-sent-${campaign.id}`}>{campaign.sent}</p>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Abertura</p>
                  <p className="text-sm sm:text-xl font-bold" data-testid={`text-open-rate-${campaign.id}`}>{campaign.openRate}</p>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Receita</p>
                  <p className="text-sm sm:text-xl font-bold text-emerald-600" data-testid={`text-revenue-${campaign.id}`}>{campaign.revenue}</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const currentTemplates = messageTemplates[formData.channel as keyof typeof messageTemplates] || [];

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Campanhas e Comunicação</h1>
            <p className="text-sm text-muted-foreground">Crie e gerencie campanhas de WhatsApp, SMS e Email.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 text-xs sm:text-sm flex-1 sm:flex-none" data-testid="button-calendar">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendário</span>
            </Button>
            <Button 
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-xs sm:text-sm flex-1 sm:flex-none" 
              onClick={openCreateModal}
              data-testid="button-new-campaign"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Criar Campanha</span>
              <span className="sm:hidden">Criar</span>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full sm:w-auto flex overflow-x-auto">
            <TabsTrigger value="all" className="text-xs sm:text-sm flex-1 sm:flex-none" data-testid="tab-all">
              <span className="hidden sm:inline">Todas as Campanhas</span>
              <span className="sm:hidden">Todas</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs sm:text-sm flex-1 sm:flex-none" data-testid="tab-whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="sms" className="text-xs sm:text-sm flex-1 sm:flex-none" data-testid="tab-sms">SMS</TabsTrigger>
            <TabsTrigger value="email" className="text-xs sm:text-sm flex-1 sm:flex-none" data-testid="tab-email">Email</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            {renderCampaignList(filterCampaigns())}
          </TabsContent>
          <TabsContent value="whatsapp" className="mt-6">
            {renderCampaignList(filterCampaigns("WhatsApp"))}
          </TabsContent>
          <TabsContent value="sms" className="mt-6">
            {renderCampaignList(filterCampaigns("SMS"))}
          </TabsContent>
          <TabsContent value="email" className="mt-6">
            {renderCampaignList(filterCampaigns("Email"))}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" data-testid="campaign-modal">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
            <DialogDescription>
              {editingCampaign 
                ? "Atualize as informações da campanha." 
                : "Configure sua campanha de comunicação."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Campanha *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Promoção de Verão"
                  required
                  data-testid="input-campaign-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">Canal *</Label>
                <Select
                  value={formData.channel}
                  onValueChange={(value) => setFormData({ ...formData, channel: value, message: "" })}
                >
                  <SelectTrigger data-testid="select-channel">
                    <SelectValue placeholder="Selecione o canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WhatsApp">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-green-600" />
                        WhatsApp
                      </div>
                    </SelectItem>
                    <SelectItem value="SMS">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-blue-600" />
                        SMS
                      </div>
                    </SelectItem>
                    <SelectItem value="Email">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-orange-600" />
                        Email
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">Audiência *</Label>
              <Select
                value={formData.audience}
                onValueChange={(value) => setFormData({ ...formData, audience: value })}
              >
                <SelectTrigger data-testid="select-audience">
                  <SelectValue placeholder="Selecione a audiência" />
                </SelectTrigger>
                <SelectContent>
                  {audienceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center justify-between w-full">
                        <span>{option.label}</span>
                        <Badge variant="secondary" className="ml-2">
                          {getAudienceCount(option.value)} clientes
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Templates de Mensagem</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentTemplates.map((template, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(template)}
                    className="text-xs"
                    data-testid={`button-template-${index}`}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="message">Mensagem</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPreviewOpen(true)}
                  disabled={!formData.message}
                  data-testid="button-preview"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Pré-visualizar
                </Button>
              </div>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Digite sua mensagem aqui. Use {{nome}} para o nome do cliente e {{categoria}} para a categoria favorita."
                className="min-h-[150px]"
                data-testid="textarea-message"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: <code className="bg-muted px-1 rounded">{"{{nome}}"}</code>, <code className="bg-muted px-1 rounded">{"{{categoria}}"}</code>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Status da campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rascunho">Rascunho</SelectItem>
                    <SelectItem value="Agendado">Agendado</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Data de Envio</Label>
                <Input
                  id="scheduledAt"
                  type="date"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                  data-testid="input-date"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal} data-testid="button-cancel">
                Cancelar
              </Button>
              <Button type="submit" disabled={isMutating} data-testid="button-save-campaign">
                {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingCampaign ? "Salvar" : "Criar Campanha"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[400px]" data-testid="preview-modal">
          <DialogHeader>
            <DialogTitle>Pré-visualização da Mensagem</DialogTitle>
            <DialogDescription>
              Veja como sua mensagem será exibida para o cliente.
            </DialogDescription>
          </DialogHeader>
          <div className={`
            p-4 rounded-lg 
            ${formData.channel === 'WhatsApp' ? 'bg-green-50 border border-green-200' : 
              formData.channel === 'SMS' ? 'bg-blue-50 border border-blue-200' : 'bg-orange-50 border border-orange-200'}
          `}>
            <div className="flex items-center gap-2 mb-3">
              {formData.channel === 'WhatsApp' ? <MessageSquare className="h-5 w-5 text-green-600" /> : 
               formData.channel === 'SMS' ? <Smartphone className="h-5 w-5 text-blue-600" /> : <Mail className="h-5 w-5 text-orange-600" />}
              <span className="font-medium">{formData.channel}</span>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm whitespace-pre-wrap text-sm">
              {getPreviewMessage()}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)} data-testid="button-close-preview">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A campanha "{campaignToDelete?.name}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
