import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  Mail,
  Smartphone,
  Send,
  Plus,
  Loader2,
  Eye,
  Sparkles,
  Users,
  MoreHorizontal,
  Pencil,
  Trash2,
  TrendingUp,
  MousePointer,
  DollarSign,
  Filter,
  Calendar,
  Gift,
  Heart,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Clock,
  BarChart3,
  Target,
  Star
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Campaign, Customer } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data para métricas ao longo do tempo
const performanceData = [
  { data: '01/12', enviadas: 450, entregues: 445, abertas: 223, cliques: 89, conversoes: 12 },
  { data: '05/12', enviadas: 520, entregues: 515, abertas: 268, cliques: 103, conversoes: 15 },
  { data: '10/12', enviadas: 680, entregues: 670, abertas: 335, cliques: 134, conversoes: 22 },
  { data: '15/12', enviadas: 590, entregues: 585, abertas: 292, cliques: 117, conversoes: 18 },
  { data: '20/12', enviadas: 720, entregues: 710, abertas: 355, cliques: 142, conversoes: 25 },
];

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

// Templates organizados por categoria
const templateCategories = {
  reativacao: {
    label: "Reativação",
    icon: RefreshCw,
    color: "bg-blue-100 text-blue-700",
    templates: [
      {
        name: "Sentimos sua falta",
        channel: "WhatsApp",
        preview: "Olá {{nome}}, sentimos sua falta! 💙\n\nFaz tempo que não nos vemos. Temos novidades especiais esperando por você!\n\nVolte e ganhe 15% OFF com o cupom VOLTEI15 🎁",
        variables: ["nome"]
      },
      {
        name: "Volte e ganhe desconto",
        channel: "WhatsApp",
        preview: "{{nome}}, está com saudades? 😊\n\nPreparamos uma surpresa especial: 20% de desconto na sua próxima compra!\n\nUse o cupom RETORNO20 até o fim da semana! 🛍️",
        variables: ["nome"]
      }
    ]
  },
  cashback: {
    label: "Cashback",
    icon: DollarSign,
    color: "bg-green-100 text-green-700",
    templates: [
      {
        name: "Cashback disponível",
        channel: "WhatsApp",
        preview: "Oi {{nome}}! 💰\n\nVocê tem R$ {{saldo}} em cashback esperando!\n\nUse na sua próxima compra e economize ainda mais. Válido até {{validade}} 🎉",
        variables: ["nome", "saldo", "validade"]
      },
      {
        name: "Cashback expirando",
        channel: "SMS",
        preview: "{{nome}}, ATENÇÃO! Seu cashback de R${{saldo}} expira em 7 dias. Use agora: www.loja.com/cashback",
        variables: ["nome", "saldo"]
      }
    ]
  },
  boasvindas: {
    label: "Boas-vindas",
    icon: Heart,
    color: "bg-purple-100 text-purple-700",
    templates: [
      {
        name: "Bem-vindo à família",
        channel: "WhatsApp",
        preview: "Olá {{nome}}! 👋✨\n\nSeja muito bem-vindo(a) à nossa família!\n\nEstamos muito felizes em tê-lo(a) conosco. Para começar bem, aqui está um presente: 10% OFF na primeira compra!\n\nUse: BEMVINDO10 🎁",
        variables: ["nome"]
      },
      {
        name: "Primeira compra especial",
        channel: "Email",
        preview: "Olá {{nome}},\n\nObrigado por se juntar a nós! 💜\n\nPara tornar sua primeira experiência ainda mais especial, preparamos um desconto exclusivo de 15% em toda a loja.\n\nSeu cupom: PRIMEIRA15\n\nAproveite!",
        variables: ["nome"]
      }
    ]
  },
  aniversario: {
    label: "Aniversário",
    icon: Gift,
    color: "bg-pink-100 text-pink-700",
    templates: [
      {
        name: "Parabéns especial",
        channel: "WhatsApp",
        preview: "🎂🎉 FELIZ ANIVERSÁRIO, {{nome}}! 🎉🎂\n\nHoje é seu dia especial e preparamos um presente incrível: 25% OFF em TODA a loja!\n\nCupom: NIVER25\n\nCelebre com estilo! 🎁✨",
        variables: ["nome"]
      },
      {
        name: "Presente de aniversário",
        channel: "WhatsApp",
        preview: "Parabéns pelo seu dia, {{nome}}! 🎊\n\nQue tal um presente especial? Use o cupom ANIVERSARIO20 e ganhe 20% de desconto + FRETE GRÁTIS! 🎁\n\nVálido por 7 dias!",
        variables: ["nome"]
      }
    ]
  },
  promocoes: {
    label: "Promoções",
    icon: Sparkles,
    color: "bg-orange-100 text-orange-700",
    templates: [
      {
        name: "Black Friday",
        channel: "WhatsApp",
        preview: "🖤 BLACK FRIDAY {{nome}}! 🖤\n\nAté 70% OFF em TUDO!\n\nCorra! Estoque limitado e condições imperdíveis esperando por você! 🔥\n\nAcesse agora: www.loja.com/black",
        variables: ["nome"]
      },
      {
        name: "Promoção relâmpago",
        channel: "SMS",
        preview: "{{nome}}, HOJE SÓ! 50% OFF em {{categoria}}! Use RELAMPAGO50 até meia-noite! www.loja.com",
        variables: ["nome", "categoria"]
      },
      {
        name: "Natal especial",
        channel: "Email",
        preview: "🎄 {{nome}}, o Natal chegou na nossa loja!\n\nDescontos de até 50% em presentes especiais.\nFrete GRÁTIS acima de R$150\n\nTorne o Natal ainda mais mágico! ✨",
        variables: ["nome"]
      }
    ]
  }
};

const audienceOptions = [
  { value: "Todos os clientes", label: "Todos os clientes", icon: Users, description: "Base completa" },
  { value: "Clientes VIP", label: "Clientes VIP", icon: Star, description: "Alto valor" },
  { value: "Novos clientes", label: "Novos clientes", icon: Sparkles, description: "Últimos 30 dias" },
  { value: "Clientes inativos", label: "Clientes inativos", icon: Clock, description: "+90 dias sem compra" },
  { value: "Aniversariantes do mês", label: "Aniversariantes", icon: Gift, description: "Aniversário no mês" },
  { value: "Com cashback alto", label: "Cashback alto", icon: DollarSign, description: "Saldo > R$50" },
];

function KPICard({ title, value, subtitle, icon: Icon, trend, color }: any) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
            <div className="flex items-baseline gap-1 sm:gap-2 mt-2">
              <p className="text-2xl sm:text-3xl font-bold">{value}</p>
              {trend && (
                <span className={`text-xs sm:text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {trend > 0 ? '+' : ''}{trend}%
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`p-2 sm:p-3 rounded-full ${color} shrink-0`}>
            <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Campaigns() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState<CampaignFormData>(initialFormData);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [previewCustomer, setPreviewCustomer] = useState({
    nome: "Maria Silva",
    categoria: "Vestidos",
    saldo: "50,00",
    validade: "31/12/2024"
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/v1/campaigns");
      if (!response.ok) throw new Error("Erro ao carregar campanhas");
      return response.json();
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const response = await fetch("/api/v1/customers");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Campaign>) => {
      const response = await apiRequest("POST", "/campaigns", data);
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
      const response = await apiRequest("PUT", `/campaigns/${id}`, data);
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
      const response = await apiRequest("DELETE", `/campaigns/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Sucesso!", description: "Campanha excluída com sucesso." });
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

  const applyTemplate = (template: any) => {
    setFormData({
      ...formData,
      message: template.preview,
      channel: template.channel
    });
  };

  const getPreviewMessage = () => {
    return formData.message
      .replace(/\{\{nome\}\}/g, previewCustomer.nome)
      .replace(/\{\{categoria\}\}/g, previewCustomer.categoria)
      .replace(/\{\{saldo\}\}/g, previewCustomer.saldo)
      .replace(/\{\{validade\}\}/g, previewCustomer.validade);
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
          // Parse date in ISO format (YYYY-MM-DD) or DD/MM/YYYY
          let month: number;
          if (c.birthDate.includes('-')) {
            // ISO format: YYYY-MM-DD
            const [year, monthStr] = c.birthDate.split('-');
            month = parseInt(monthStr);
          } else if (c.birthDate.includes('/')) {
            // Brazilian format: DD/MM/YYYY
            const [day, monthStr] = c.birthDate.split('/');
            month = parseInt(monthStr);
          } else {
            return false;
          }
          return month === currentMonth;
        }).length;
      default:
        return 0;
    }
  };

  // Cálculo de KPIs
  const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0);
  const avgDelivery = campaigns.length > 0 ? 98.5 : 0;
  const avgOpenRate = campaigns.length > 0
    ? campaigns.reduce((sum, c) => sum + c.openRate, 0) / campaigns.length
    : 0;
  const avgClickRate = campaigns.length > 0 ? 42.3 : 0;
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversion, 0);

  // Filtrar campanhas
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (channelFilter !== "all" && c.channel !== channelFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      return true;
    });
  }, [campaigns, channelFilter, statusFilter]);

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Campanhas de Marketing</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie campanhas de WhatsApp, SMS e Email</p>
          </div>
          <Button onClick={openCreateModal} className="gap-2 shrink-0 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <KPICard
            title="Total Enviadas"
            value={totalSent.toLocaleString()}
            icon={Send}
            trend={12}
            color="bg-blue-100 text-blue-600"
          />
          <KPICard
            title="Taxa Entrega"
            value={`${avgDelivery.toFixed(1)}%`}
            icon={CheckCircle}
            trend={0.5}
            color="bg-green-100 text-green-600"
          />
          <KPICard
            title="Taxa Abertura"
            value={`${avgOpenRate.toFixed(1)}%`}
            icon={Eye}
            trend={-2.3}
            color="bg-purple-100 text-purple-600"
          />
          <KPICard
            title="Taxa Clique"
            value={`${avgClickRate.toFixed(1)}%`}
            icon={MousePointer}
            trend={5.7}
            color="bg-orange-100 text-orange-600"
          />
          <KPICard
            title="Conversões"
            value={totalConversions.toFixed(0)}
            icon={Target}
            trend={8.2}
            color="bg-pink-100 text-pink-600"
          />
        </div>

        <Tabs defaultValue="recent" className="space-y-4 sm:space-y-6">
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-grid">
            <TabsTrigger value="recent" className="text-xs sm:text-sm">Campanhas</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs sm:text-sm">Templates</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs sm:text-sm">Performance</TabsTrigger>
          </TabsList>

          {/* Campanhas Recentes */}
          <TabsContent value="recent" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os canais</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="Rascunho">Rascunho</SelectItem>
                  <SelectItem value="Agendado">Agendado</SelectItem>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block rounded-lg border">
              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 gap-2">
                  <AlertCircle className="h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhuma campanha encontrada</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium">Nome</th>
                      <th className="text-left p-4 font-medium">Canal</th>
                      <th className="text-left p-4 font-medium">Segmento</th>
                      <th className="text-center p-4 font-medium">Enviadas</th>
                      <th className="text-center p-4 font-medium">Entregues</th>
                      <th className="text-center p-4 font-medium">Abertas</th>
                      <th className="text-center p-4 font-medium">Cliques</th>
                      <th className="text-center p-4 font-medium">Conversões</th>
                      <th className="text-center p-4 font-medium">ROI</th>
                      <th className="text-center p-4 font-medium">Status</th>
                      <th className="text-center p-4 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((campaign) => {
                    const delivered = Math.floor(campaign.sent * 0.98);
                    const opened = Math.floor(campaign.sent * (campaign.openRate / 100));
                    const clicked = Math.floor(opened * 0.4);
                    const roi = campaign.revenue > 0 ? ((campaign.revenue - 500) / 500 * 100).toFixed(1) : '0';

                    return (
                      <tr key={campaign.id} className="border-b hover:bg-muted/50">
                        <td className="p-4 font-medium">{campaign.name}</td>
                        <td className="p-4">
                          <Badge variant="outline" className="gap-1">
                            {campaign.channel === 'WhatsApp' && <MessageSquare className="h-3 w-3" />}
                            {campaign.channel === 'SMS' && <Smartphone className="h-3 w-3" />}
                            {campaign.channel === 'Email' && <Mail className="h-3 w-3" />}
                            {campaign.channel}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">{campaign.audience}</td>
                        <td className="text-center p-4">{campaign.sent}</td>
                        <td className="text-center p-4">{delivered}</td>
                        <td className="text-center p-4">{opened}</td>
                        <td className="text-center p-4">{clicked}</td>
                        <td className="text-center p-4">{campaign.conversion}</td>
                        <td className="text-center p-4">
                          <span className={`font-medium ${Number(roi) > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            {Number(roi) > 0 ? '+' : ''}{roi}%
                          </span>
                        </td>
                        <td className="text-center p-4">
                          <Badge variant={campaign.status === 'Ativo' ? 'default' : 'secondary'}>
                            {campaign.status}
                          </Badge>
                        </td>
                        <td className="text-center p-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditModal(campaign)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteMutation.mutate(campaign.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden grid gap-4">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-12 w-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada</p>
                  </div>
                </Card>
              ) : null}
              {!isLoading && filteredCampaigns.map((campaign) => {
                const delivered = Math.floor(campaign.sent * 0.98);
                const opened = Math.floor(campaign.sent * (campaign.openRate / 100));
                const clicked = Math.floor(opened * 0.4);
                const roi = campaign.revenue > 0 ? ((campaign.revenue - 500) / 500 * 100).toFixed(1) : '0';

                return (
                  <Card key={campaign.id}>
                    <CardHeader className="p-4 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="gap-1 text-xs">
                              {campaign.channel === 'WhatsApp' && <MessageSquare className="h-3 w-3" />}
                              {campaign.channel === 'SMS' && <Smartphone className="h-3 w-3" />}
                              {campaign.channel === 'Email' && <Mail className="h-3 w-3" />}
                              {campaign.channel}
                            </Badge>
                            <Badge variant={campaign.status === 'Ativo' ? 'default' : 'secondary'} className="text-xs">
                              {campaign.status}
                            </Badge>
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(campaign)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteMutation.mutate(campaign.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                      <div className="text-sm text-muted-foreground">
                        {campaign.audience}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex flex-col p-2 bg-muted/50 rounded">
                          <span className="text-xs text-muted-foreground">Enviadas</span>
                          <span className="font-semibold">{campaign.sent}</span>
                        </div>
                        <div className="flex flex-col p-2 bg-muted/50 rounded">
                          <span className="text-xs text-muted-foreground">Entregues</span>
                          <span className="font-semibold">{delivered}</span>
                        </div>
                        <div className="flex flex-col p-2 bg-muted/50 rounded">
                          <span className="text-xs text-muted-foreground">Abertas</span>
                          <span className="font-semibold">{opened}</span>
                        </div>
                        <div className="flex flex-col p-2 bg-muted/50 rounded">
                          <span className="text-xs text-muted-foreground">Cliques</span>
                          <span className="font-semibold">{clicked}</span>
                        </div>
                        <div className="flex flex-col p-2 bg-muted/50 rounded">
                          <span className="text-xs text-muted-foreground">Conversões</span>
                          <span className="font-semibold">{campaign.conversion}</span>
                        </div>
                        <div className="flex flex-col p-2 bg-muted/50 rounded">
                          <span className="text-xs text-muted-foreground">ROI</span>
                          <span className={`font-semibold ${Number(roi) > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                            {Number(roi) > 0 ? '+' : ''}{roi}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Templates */}
          <TabsContent value="templates" className="space-y-4 sm:space-y-6">
            {Object.entries(templateCategories).map(([key, category]) => {
              const Icon = category.icon;
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <h3 className="text-base sm:text-lg font-semibold">{category.label}</h3>
                  </div>
                  <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {category.templates.map((template, idx) => (
                      <Card key={idx} className="hover:shadow-lg transition-shadow cursor-pointer">
                        <CardHeader className="p-4 sm:p-6">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-sm sm:text-base truncate">{template.name}</CardTitle>
                              <CardDescription className="flex items-center gap-1 mt-1">
                                {template.channel === 'WhatsApp' && <MessageSquare className="h-3 w-3" />}
                                {template.channel === 'SMS' && <Smartphone className="h-3 w-3" />}
                                {template.channel === 'Email' && <Mail className="h-3 w-3" />}
                                {template.channel}
                              </CardDescription>
                            </div>
                            <Badge className={`${category.color} shrink-0 text-xs`}>{category.label}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 p-4 sm:p-6 pt-0">
                          <div className="bg-muted/50 p-3 rounded-lg text-xs sm:text-sm whitespace-pre-wrap min-h-[100px] max-h-[150px] overflow-y-auto">
                            {template.preview.substring(0, 150)}...
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setFormData({ ...formData, message: template.preview });
                                setIsPreviewOpen(true);
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Preview
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                applyTemplate(template);
                                setIsModalOpen(true);
                              }}
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Usar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {/* Performance */}
          <TabsContent value="performance" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Histórico de Performance</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Métricas das últimas campanhas</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="h-[300px] sm:h-[400px] w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="data" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="enviadas" stroke="#3b82f6" name="Enviadas" strokeWidth={2} />
                      <Line type="monotone" dataKey="abertas" stroke="#8b5cf6" name="Abertas" strokeWidth={2} />
                      <Line type="monotone" dataKey="cliques" stroke="#f59e0b" name="Cliques" strokeWidth={2} />
                      <Line type="monotone" dataKey="conversoes" stroke="#10b981" name="Conversões" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Criação/Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">{editingCampaign ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Configure os detalhes da campanha</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm">Nome da Campanha *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Promoção Black Friday"
                  required
                  className="text-sm sm:text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel" className="text-sm">Canal *</Label>
                <Select
                  value={formData.channel}
                  onValueChange={(value) => setFormData({ ...formData, channel: value })}
                >
                  <SelectTrigger className="text-sm sm:text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience" className="text-sm">Audiência *</Label>
              <Select
                value={formData.audience}
                onValueChange={(value) => setFormData({ ...formData, audience: value })}
              >
                <SelectTrigger className="text-sm sm:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {audienceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="truncate">{option.label}</span>
                        <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                          {getAudienceCount(option.value)}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="text-sm">Mensagem</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Digite sua mensagem..."
                className="min-h-[120px] sm:min-h-[150px] text-sm sm:text-base"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: <code>{"{{nome}}"}</code>, <code>{"{{categoria}}"}</code>, <code>{"{{saldo}}"}</code>
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className="text-sm sm:text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rascunho">Rascunho</SelectItem>
                    <SelectItem value="Agendado">Agendado</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduledAt" className="text-sm">Data de Envio</Label>
                <Input
                  id="scheduledAt"
                  type="date"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                  className="text-sm sm:text-base"
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={closeModal} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button type="submit" disabled={isMutating} className="w-full sm:w-auto">
                {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingCampaign ? "Salvar" : "Criar Campanha"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Preview */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="w-[95vw] sm:w-full sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Preview da Mensagem</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Como o cliente verá a mensagem</DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 p-3 sm:p-4 rounded-lg max-h-[50vh] overflow-y-auto">
            <div className="bg-white rounded-lg p-3 sm:p-4 shadow-sm whitespace-pre-wrap text-sm sm:text-base break-words">
              {getPreviewMessage()}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)} className="w-full sm:w-auto">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
