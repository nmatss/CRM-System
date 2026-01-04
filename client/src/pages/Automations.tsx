import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Zap,
  Clock,
  UserCheck,
  ShoppingCart,
  ArrowRight,
  Gift,
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Mail,
  MessageSquare,
  AlertCircle,
  Calendar,
  PlayCircle,
  CheckCircle2,
  XCircle,
  DollarSign,
  Heart,
  TrendingUp,
  Target,
  Activity,
  Sparkles
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Automation } from "@shared/schema";

const iconMap: Record<string, React.ComponentType<any>> = {
  ShoppingCart,
  UserCheck,
  Gift,
  Clock,
  Zap,
  Mail,
  MessageSquare,
  AlertCircle,
  Calendar,
  DollarSign,
  Heart
};

const iconOptions = [
  { value: "ShoppingCart", label: "Carrinho", icon: ShoppingCart },
  { value: "UserCheck", label: "Cliente", icon: UserCheck },
  { value: "Gift", label: "Presente", icon: Gift },
  { value: "Clock", label: "Tempo", icon: Clock },
  { value: "Zap", label: "Automação", icon: Zap },
  { value: "Mail", label: "Email", icon: Mail },
  { value: "MessageSquare", label: "Mensagem", icon: MessageSquare },
  { value: "Calendar", label: "Calendário", icon: Calendar },
  { value: "DollarSign", label: "Dinheiro", icon: DollarSign },
  { value: "Heart", label: "Coração", icon: Heart },
];

const suggestedAutomations = [
  {
    name: "Cashback 2 semanas após compra",
    trigger: "Quando uma compra é finalizada",
    condition: "Aguardar 14 dias",
    action: "Enviar WhatsApp informando cashback disponível",
    icon: "DollarSign",
    category: "Cashback",
    estimatedImpact: "Alta conversão em recompra"
  },
  {
    name: "Lembrete de saldo expirando",
    trigger: "Quando cashback está próximo de expirar",
    condition: "Faltam 7 dias para expiração",
    action: "Enviar SMS alertando sobre expiração",
    icon: "AlertCircle",
    category: "Cashback",
    estimatedImpact: "Reduz perda de cashback"
  },
  {
    name: "Boas-vindas novo cliente",
    trigger: "Quando novo cliente se cadastra",
    condition: "Imediatamente",
    action: "Enviar WhatsApp de boas-vindas + cupom 10% OFF",
    icon: "Heart",
    category: "Engajamento",
    estimatedImpact: "Aumenta primeira compra"
  },
  {
    name: "Reativação cliente inativo 30 dias",
    trigger: "Quando cliente não compra há 30 dias",
    condition: "Cliente era ativo (3+ compras)",
    action: "Enviar Email com oferta personalizada 15% OFF",
    icon: "Clock",
    category: "Retenção",
    estimatedImpact: "Recupera 25% dos inativos"
  },
  {
    name: "Aniversário do cliente",
    trigger: "No dia do aniversário",
    condition: "Aniversário cadastrado",
    action: "Enviar WhatsApp de parabéns + cupom 20% OFF",
    icon: "Gift",
    category: "Engajamento",
    estimatedImpact: "Alto engajamento emocional"
  },
  {
    name: "Cliente VIP especial",
    trigger: "Quando cliente atinge R$ 5.000 em compras",
    condition: "LTV >= R$ 5.000",
    action: "Enviar Email de upgrade para programa VIP",
    icon: "UserCheck",
    category: "Fidelização",
    estimatedImpact: "Aumenta LTV em 40%"
  },
  {
    name: "Carrinho abandonado",
    trigger: "Quando cliente adiciona item e não finaliza",
    condition: "Aguardar 24 horas",
    action: "Enviar WhatsApp lembrando itens do carrinho",
    icon: "ShoppingCart",
    category: "Conversão",
    estimatedImpact: "Recupera 30% dos carrinhos"
  },
  {
    name: "Recompra sugerida",
    trigger: "Quando produto é usado com frequência",
    condition: "Última compra há 30 dias (produtos consumíveis)",
    action: "Enviar SMS sugerindo recompra com 10% OFF",
    icon: "ShoppingCart",
    category: "Recorrência",
    estimatedImpact: "Aumenta frequência de compra"
  },
];

// Mock data para execuções recentes
const recentExecutions = [
  {
    id: 1,
    automation: "Boas-vindas novo cliente",
    customer: "Ana Paula Silva",
    executedAt: "2024-12-17T10:30:00",
    status: "success",
    action: "WhatsApp enviado"
  },
  {
    id: 2,
    automation: "Cashback após compra",
    customer: "Carlos Mendes",
    executedAt: "2024-12-17T09:15:00",
    status: "success",
    action: "Email enviado"
  },
  {
    id: 3,
    automation: "Aniversário do cliente",
    customer: "Mariana Costa",
    executedAt: "2024-12-17T08:00:00",
    status: "success",
    action: "WhatsApp enviado"
  },
  {
    id: 4,
    automation: "Cliente inativo",
    customer: "Pedro Santos",
    executedAt: "2024-12-16T18:45:00",
    status: "failed",
    action: "Erro ao enviar email"
  },
  {
    id: 5,
    automation: "Lembrete cashback",
    customer: "Juliana Oliveira",
    executedAt: "2024-12-16T16:20:00",
    status: "success",
    action: "SMS enviado"
  },
];

interface AutomationFormData {
  title: string;
  description: string;
  icon: string;
  isActive: boolean;
  stats: string;
}

const initialFormData: AutomationFormData = {
  title: "",
  description: "",
  icon: "Zap",
  isActive: true,
  stats: "0 execuções",
};

function SuggestedAutomationCard({ automation, onUse }: any) {
  const Icon = iconMap[automation.icon] || Zap;

  return (
    <Card className="hover:shadow-lg transition-all hover:border-primary/50">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 flex-shrink-0">
              <Icon className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm sm:text-base break-words">{automation.name}</CardTitle>
              <CardDescription className="mt-1">
                <Badge variant="secondary" className="text-xs">
                  {automation.category}
                </Badge>
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <PlayCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-medium text-blue-600 text-xs sm:text-sm">Trigger:</span>
              <p className="text-muted-foreground text-xs sm:text-sm break-words">{automation.trigger}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Target className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-medium text-purple-600 text-xs sm:text-sm">Condição:</span>
              <p className="text-muted-foreground text-xs sm:text-sm break-words">{automation.condition}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-medium text-green-600 text-xs sm:text-sm">Ação:</span>
              <p className="text-muted-foreground text-xs sm:text-sm break-words">{automation.action}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
          <TrendingUp className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span className="text-xs text-green-700 font-medium break-words">{automation.estimatedImpact}</span>
        </div>

        <Button className="w-full gap-2 min-h-[44px] touch-manipulation" onClick={() => onUse(automation)}>
          <Sparkles className="h-4 w-4" />
          Usar esta automação
        </Button>
      </CardContent>
    </Card>
  );
}

function ExecutionTimelineItem({ execution }: any) {
  const statusConfig = {
    success: {
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-100"
    },
    failed: {
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-100"
    },
    pending: {
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-100"
    }
  };

  const config = statusConfig[execution.status as keyof typeof statusConfig];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg hover:bg-muted/50 transition-colors">
      <div className={`p-2 rounded-lg ${config.bg} flex-shrink-0`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <p className="font-medium text-sm break-words">{execution.automation}</p>
          <ArrowRight className="h-3 w-3 text-muted-foreground hidden sm:inline-block flex-shrink-0" />
          <p className="text-sm text-muted-foreground truncate">{execution.customer}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(execution.executedAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
          <p className={`text-xs ${config.color} break-words`}>{execution.action}</p>
        </div>
      </div>
    </div>
  );
}

export default function Automations() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [formData, setFormData] = useState<AutomationFormData>(initialFormData);
  const [activeTab, setActiveTab] = useState("list");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: automations = [], isLoading } = useQuery<Automation[]>({
    queryKey: ["automations"],
    queryFn: async () => {
      const response = await fetch("/api/v1/automations");
      if (!response.ok) throw new Error("Erro ao carregar automações");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Automation>) => {
      const response = await apiRequest("POST", "/automations", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: "Sucesso!", description: "Automação criada com sucesso." });
      closeModal();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível criar a automação.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Automation> }) => {
      const response = await apiRequest("PUT", `/automations/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: "Sucesso!", description: "Automação atualizada com sucesso." });
      closeModal();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível atualizar a automação.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/automations/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: "Sucesso!", description: "Automação excluída com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível excluir a automação.", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PATCH", `/automations/${id}/toggle`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível alternar a automação.", variant: "destructive" });
    },
  });

  const openCreateModal = () => {
    setEditingAutomation(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (automation: Automation) => {
    setEditingAutomation(automation);
    setFormData({
      title: automation.title,
      description: automation.description,
      icon: automation.icon,
      isActive: automation.isActive,
      stats: automation.stats || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAutomation(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const automationData = {
      title: formData.title,
      description: formData.description,
      icon: formData.icon,
      isActive: formData.isActive,
      stats: formData.stats || "0 execuções",
    };

    if (editingAutomation) {
      updateMutation.mutate({ id: editingAutomation.id, data: automationData });
    } else {
      createMutation.mutate(automationData);
    }
  };

  const handleUseSuggested = (suggested: any) => {
    setFormData({
      title: suggested.name,
      description: `${suggested.trigger} → ${suggested.action}`,
      icon: suggested.icon,
      isActive: true,
      stats: "0 execuções"
    });
    setIsModalOpen(true);
  };

  const handleToggle = (automation: Automation) => {
    toggleMutation.mutate(automation.id);
  };

  const getIconComponent = (iconName: string) => {
    return iconMap[iconName] || Zap;
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  // Stats
  const activeCount = automations.filter(a => a.isActive).length;
  const totalExecutions = automations.reduce((sum, a) => {
    const match = a.stats?.match(/(\d+)/);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">Automações de Marketing</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Configure regras inteligentes para engajar clientes</p>
          </div>
          <Button onClick={openCreateModal} className="gap-2 bg-amber-500 hover:bg-amber-600 text-black min-h-[44px] touch-manipulation shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Automação</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Automações Ativas</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-2">{activeCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">de {automations.length} total</p>
                </div>
                <div className="p-2 sm:p-3 rounded-full bg-green-100 flex-shrink-0">
                  <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Execuções</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-2">{totalExecutions.toLocaleString()}</p>
                  <p className="text-xs text-green-600 mt-1">+24% vs. mês passado</p>
                </div>
                <div className="p-2 sm:p-3 rounded-full bg-blue-100 flex-shrink-0">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="sm:col-span-2 lg:col-span-1">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Taxa de Sucesso</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-2">94.5%</p>
                  <p className="text-xs text-muted-foreground mt-1">Últimos 7 dias</p>
                </div>
                <div className="p-2 sm:p-3 rounded-full bg-purple-100 flex-shrink-0">
                  <Target className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="list" className="text-xs sm:text-sm min-h-[44px] px-2 sm:px-4">
              <span className="hidden sm:inline">Minhas Automações</span>
              <span className="sm:hidden">Minhas</span>
            </TabsTrigger>
            <TabsTrigger value="suggested" className="text-xs sm:text-sm min-h-[44px] px-2 sm:px-4">
              <span className="hidden sm:inline">Automações Sugeridas</span>
              <span className="sm:hidden">Sugeridas</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm min-h-[44px] px-2 sm:px-4">
              <span className="hidden sm:inline">Histórico de Execução</span>
              <span className="sm:hidden">Histórico</span>
            </TabsTrigger>
          </TabsList>

          {/* Lista de Automações Ativas */}
          <TabsContent value="list" className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : automations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center px-4">
                  <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold mb-2">Nenhuma automação criada</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Comece criando sua primeira automação ou use nossas sugestões
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button variant="outline" onClick={() => setActiveTab("suggested")} className="min-h-[44px]">
                      Ver Sugestões
                    </Button>
                    <Button onClick={openCreateModal} className="min-h-[44px]">
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Automação
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {automations.map((automation) => {
                  const IconComponent = getIconComponent(automation.icon);
                  return (
                    <Card
                      key={automation.id}
                      className={`relative overflow-hidden border-l-4 transition-all ${
                        automation.isActive ? 'border-l-amber-500 hover:shadow-lg' : 'border-l-transparent opacity-60'
                      }`}
                    >
                      <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between space-y-3 sm:space-y-0 pb-3 p-4 sm:p-6">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`p-2 rounded-md flex-shrink-0 ${automation.isActive ? 'bg-amber-100' : 'bg-muted'}`}>
                            <IconComponent className={`h-5 w-5 ${automation.isActive ? 'text-amber-600' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm sm:text-base font-semibold break-words">{automation.title}</CardTitle>
                            {automation.isActive && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                <Activity className="h-3 w-3 mr-1" />
                                Ativo
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <div className="scale-110 sm:scale-100" style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Switch
                              checked={automation.isActive}
                              onCheckedChange={() => handleToggle(automation)}
                            />
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8 touch-manipulation">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[160px]">
                              <DropdownMenuItem onClick={() => openEditModal(automation)} className="min-h-[44px] touch-manipulation">
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive min-h-[44px] touch-manipulation"
                                onClick={() => deleteMutation.mutate(automation.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6">
                        <CardDescription className="mb-4 text-xs sm:text-sm break-words">{automation.description}</CardDescription>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <span className="text-xs sm:text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded whitespace-nowrap">
                            {automation.stats}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 min-h-[44px] touch-manipulation w-full sm:w-auto"
                            onClick={() => openEditModal(automation)}
                          >
                            Editar <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Automações Sugeridas */}
          <TabsContent value="suggested" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suggestedAutomations.map((automation, idx) => (
                <SuggestedAutomationCard
                  key={idx}
                  automation={automation}
                  onUse={handleUseSuggested}
                />
              ))}
            </div>
          </TabsContent>

          {/* Histórico de Execução */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Execuções Recentes</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Timeline das últimas execuções automáticas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-4 sm:p-6">
                {recentExecutions.map((execution) => (
                  <ExecutionTimelineItem key={execution.id} execution={execution} />
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Criação/Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg sm:text-xl">{editingAutomation ? "Editar Automação" : "Nova Automação"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Configure os detalhes da automação</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm sm:text-base">Nome da Automação *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Boas-vindas ao cliente"
                  className="min-h-[44px] text-base"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon" className="text-sm sm:text-base">Ícone</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData({ ...formData, icon: value })}
                >
                  <SelectTrigger className="min-h-[44px] text-base">
                    <SelectValue placeholder="Selecione o ícone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {iconOptions.map((option) => {
                      const IconComp = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value} className="min-h-[44px] text-base touch-manipulation">
                          <div className="flex items-center gap-2">
                            <IconComp className="h-4 w-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm sm:text-base">Descrição da Regra *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Quando cliente fizer primeira compra → Enviar WhatsApp de boas-vindas"
                className="min-h-[120px] text-base"
                required
              />
              <p className="text-xs text-muted-foreground">
                Descreva o gatilho e a ação. Use o formato: "Quando [gatilho] → [ação]"
              </p>
            </div>

            <div className="flex items-center justify-between py-2">
              <Label htmlFor="isActive" className="text-sm sm:text-base">Automação ativa</Label>
              <div className="scale-110 sm:scale-100" style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeModal} className="w-full sm:w-auto min-h-[44px] touch-manipulation order-2 sm:order-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={isMutating} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-black min-h-[44px] touch-manipulation order-1 sm:order-2">
                {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingAutomation ? "Salvar" : "Criar Automação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
