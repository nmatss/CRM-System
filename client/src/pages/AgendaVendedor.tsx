import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  MessageCircle, 
  Phone, 
  Check, 
  Copy, 
  ChevronDown, 
  ChevronUp,
  Gift,
  ShoppingCart,
  RefreshCw,
  Crown,
  Calendar,
  Plus,
  Filter,
  Clock,
  AlertTriangle,
  CheckCircle,
  ListTodo,
  X,
  User,
  TrendingUp,
  Target
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SellerTask, Customer } from "@shared/schema";

type TaskType = "aniversario" | "carrinho_abandonado" | "recompra" | "vip_sumido" | "manual";

interface TaskWithCustomer extends SellerTask {
  customer?: Customer;
}

interface SellerStats {
  pending: number;
  completed: number;
  today: number;
  overdue: number;
}

const taskTypeConfig: Record<TaskType, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  aniversario: {
    label: "Aniversariante",
    color: "bg-pink-500 hover:bg-pink-600",
    bgColor: "bg-pink-50 text-pink-700 border-pink-200",
    icon: <Gift className="h-3 w-3" />
  },
  carrinho_abandonado: {
    label: "Carrinho Abandonado",
    color: "bg-orange-500 hover:bg-orange-600",
    bgColor: "bg-orange-50 text-orange-700 border-orange-200",
    icon: <ShoppingCart className="h-3 w-3" />
  },
  recompra: {
    label: "Recompra Sugerida",
    color: "bg-blue-500 hover:bg-blue-600",
    bgColor: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <RefreshCw className="h-3 w-3" />
  },
  vip_sumido: {
    label: "VIP Sumido",
    color: "bg-purple-500 hover:bg-purple-600",
    bgColor: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <Crown className="h-3 w-3" />
  },
  manual: {
    label: "Tarefa Manual",
    color: "bg-gray-500 hover:bg-gray-600",
    bgColor: "bg-gray-50 text-gray-700 border-gray-200",
    icon: <ListTodo className="h-3 w-3" />
  }
};

function getDateRange(period: string): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  switch (period) {
    case 'today':
      return { dateFrom: todayStr, dateTo: todayStr };
    case 'week': {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);
      return { dateFrom: todayStr, dateTo: weekEnd.toISOString().split('T')[0] };
    }
    case 'month': {
      const monthEnd = new Date(today);
      monthEnd.setMonth(today.getMonth() + 1);
      return { dateFrom: todayStr, dateTo: monthEnd.toISOString().split('T')[0] };
    }
    default:
      return { dateFrom: '', dateTo: '' };
  }
}

function TaskCard({ 
  task, 
  onComplete, 
  isUpdating,
  showActions = true
}: { 
  task: TaskWithCustomer; 
  onComplete: (id: number) => void;
  isUpdating: boolean;
  showActions?: boolean;
}) {
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const config = taskTypeConfig[task.type as TaskType] || taskTypeConfig.manual;
  const isCompleted = task.status === 'completed';

  const handleWhatsApp = () => {
    if (!task.customer?.phone || !task.script) return;
    const texto = encodeURIComponent(task.script);
    window.open(`https://wa.me/${task.customer.phone.replace(/\D/g, '')}?text=${texto}`, "_blank");
  };

  const handleCopyScript = async () => {
    if (!task.script) return;
    await navigator.clipboard.writeText(task.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDaysAgo = (dateStr: string) => {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = today.getTime() - date.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isOverdue = task.dueDate < new Date().toISOString().split('T')[0] && task.status === 'pending';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -300, transition: { duration: 0.3 } }}
    >
      <Card className={`overflow-hidden ${isOverdue ? 'border-red-300 bg-red-50/30' : ''} ${isCompleted ? 'border-green-200 bg-green-50/30' : ''}`} data-testid={`card-tarefa-${task.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={task.customer?.image || ''} alt={task.customer?.name || 'Cliente'} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {task.customer?.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || 'CL'}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base" data-testid={`text-nome-${task.id}`}>
                    {task.customer?.name || 'Cliente'}
                  </h3>
                  {isCompleted && (
                    <Badge className="gap-1 text-xs bg-green-500 text-white">
                      <CheckCircle className="h-3 w-3" />
                      Concluída
                    </Badge>
                  )}
                  {isOverdue && (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      Atrasada
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`${config.color} text-white gap-1`} data-testid={`badge-motivo-${task.id}`}>
                    {config.icon}
                    {config.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {task.customer && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Última Compra:</span>
                <p className="font-medium" data-testid={`text-ultima-compra-${task.id}`}>
                  {task.customer.lastPurchase}
                  <span className="text-muted-foreground ml-1 block sm:inline">
                    (há {getDaysAgo(task.customer.lastPurchase)} dias)
                  </span>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">LTV Total:</span>
                <p className="font-medium text-green-600" data-testid={`text-ltv-${task.id}`}>
                  {task.customer.ltv}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Segmento:</span>
                <p className="font-medium capitalize">{task.customer.segment}</p>
              </div>
            </div>
          )}

          {task.notes && (
            <div className="mt-3 p-2 bg-muted/50 rounded text-sm">
              <span className="text-muted-foreground">Notas: </span>
              {task.notes}
            </div>
          )}

          {task.completedAt && isCompleted && (
            <div className="mt-3 p-2 bg-green-100 rounded text-sm text-green-700">
              <CheckCircle className="h-3 w-3 inline mr-1" />
              Concluída em {new Date(task.completedAt).toLocaleDateString('pt-BR')}
            </div>
          )}

          <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2">
            {task.script && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScriptExpanded(!scriptExpanded)}
                className="gap-2 w-full sm:w-auto text-xs sm:text-sm"
                data-testid={`button-ver-script-${task.id}`}
              >
                <MessageCircle className="h-4 w-4" />
                Ver Script
                {scriptExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}

            {showActions && !isCompleted && (
              <>
                {task.customer?.phone && task.script && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleWhatsApp}
                    className="gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto text-xs sm:text-sm"
                    data-testid={`button-whatsapp-${task.id}`}
                  >
                    <Phone className="h-4 w-4" />
                    <span className="hidden sm:inline">Chamar no WhatsApp</span>
                    <span className="sm:hidden">WhatsApp</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onComplete(task.id)}
                  disabled={isUpdating}
                  className="gap-2 text-green-600 border-green-600 hover:bg-green-50 w-full sm:w-auto text-xs sm:text-sm"
                  data-testid={`button-marcar-feito-${task.id}`}
                >
                  <Check className="h-4 w-4" />
                  {isUpdating ? 'Salvando...' : 'Marcar como Feito'}
                </Button>
              </>
            )}
          </div>

          <AnimatePresence>
            {scriptExpanded && task.script && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Sugestão de Mensagem:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyScript}
                      className="gap-2 h-8"
                      data-testid={`button-copiar-script-${task.id}`}
                    >
                      <Copy className="h-3 w-3" />
                      {copied ? "Copiado!" : "Copiar"}
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed" data-testid={`text-script-${task.id}`}>
                    {task.script}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TaskSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  color 
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode; 
  color: string;
}) {
  return (
    <Card className={`${color} border`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/50">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function NewTaskDialog({ 
  customers, 
  onCreateTask 
}: { 
  customers: Customer[]; 
  onCreateTask: (data: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    customerId: '',
    type: 'manual',
    dueDate: new Date().toISOString().split('T')[0],
    script: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.dueDate) {
      setError('Data de vencimento é obrigatória');
      return;
    }
    if (!formData.type) {
      setError('Tipo de tarefa é obrigatório');
      return;
    }
    
    onCreateTask({
      ...formData,
      customerId: formData.customerId ? parseInt(formData.customerId) : null,
    });
    setOpen(false);
    setFormData({
      customerId: '',
      type: 'manual',
      dueDate: new Date().toISOString().split('T')[0],
      script: '',
      notes: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-nova-tarefa">
          <Plus className="h-4 w-4" />
          Nova Tarefa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Nova Tarefa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}
          <div>
            <Label htmlFor="customer">Cliente (opcional)</Label>
            <Select 
              value={formData.customerId} 
              onValueChange={(v) => setFormData({...formData, customerId: v})}
            >
              <SelectTrigger data-testid="select-cliente">
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum cliente</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="type">Tipo de Tarefa</Label>
            <Select 
              value={formData.type} 
              onValueChange={(v) => setFormData({...formData, type: v})}
            >
              <SelectTrigger data-testid="select-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(taskTypeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="dueDate">Data de Vencimento</Label>
            <Input
              id="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
              required
              data-testid="input-data"
            />
          </div>

          <div>
            <Label htmlFor="script">Script de Mensagem</Label>
            <Textarea
              id="script"
              placeholder="Mensagem sugerida para o cliente..."
              value={formData.script}
              onChange={(e) => setFormData({...formData, script: e.target.value})}
              rows={3}
              data-testid="input-script"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notas</Label>
            <Input
              id="notes"
              placeholder="Observações adicionais..."
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              data-testid="input-notas"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" data-testid="button-criar-tarefa">
              Criar Tarefa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AgendaVendedor() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('today');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const isCompletedTab = activeTab === 'completed';
  const dateRange = isCompletedTab ? { dateFrom: '', dateTo: '' } : getDateRange(activeTab);
  const statusFilter = isCompletedTab ? 'completed' : 'pending';

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<TaskWithCustomer[]>({
    queryKey: ['/api/seller-tasks', activeTab, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.dateFrom) params.append('dateFrom', dateRange.dateFrom);
      if (dateRange.dateTo) params.append('dateTo', dateRange.dateTo);
      params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      
      const res = await fetch(`/api/seller-tasks?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Falha ao carregar tarefas');
      return res.json();
    }
  });

  const { data: stats, isLoading: statsLoading } = useQuery<SellerStats>({
    queryKey: ['/api/seller-tasks/stats'],
    queryFn: async () => {
      const res = await fetch('/api/seller-tasks/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Falha ao carregar estatísticas');
      return res.json();
    }
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
    queryFn: async () => {
      const res = await fetch('/api/customers', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const res = await fetch(`/api/seller-tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'completed' })
      });
      if (!res.ok) throw new Error('Falha ao completar tarefa');
      return res.json();
    },
    onMutate: (taskId) => {
      setUpdatingTaskId(taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return key === '/api/seller-tasks' || key === '/api/seller-tasks/stats';
        }
      });
    },
    onSettled: () => {
      setUpdatingTaskId(null);
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/seller-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Falha ao criar tarefa');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return key === '/api/seller-tasks' || key === '/api/seller-tasks/stats';
        }
      });
    }
  });

  const filteredTasks = tasks;
  const META_DIARIA = 10;
  const completedToday = stats?.completed || 0;
  const progresso = Math.min((completedToday / META_DIARIA) * 100, 100);

  return (
    <Layout>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              Agenda do Vendedor
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie suas tarefas e contatos com clientes
            </p>
          </div>
          <NewTaskDialog customers={customers} onCreateTask={createMutation.mutate} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statsLoading ? (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          ) : (
            <>
              <StatCard
                title="Para Hoje"
                value={stats?.today || 0}
                icon={<Target className="h-5 w-5 text-blue-600" />}
                color="bg-blue-50"
              />
              <StatCard
                title="Pendentes"
                value={stats?.pending || 0}
                icon={<Clock className="h-5 w-5 text-yellow-600" />}
                color="bg-yellow-50"
              />
              <StatCard
                title="Atrasadas"
                value={stats?.overdue || 0}
                icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
                color="bg-red-50"
              />
              <StatCard
                title="Concluídas"
                value={stats?.completed || 0}
                icon={<CheckCircle className="h-5 w-5 text-green-600" />}
                color="bg-green-50"
              />
            </>
          )}
        </div>

        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-base sm:text-lg font-semibold" data-testid="text-meta-titulo">
                  <TrendingUp className="h-4 w-4 inline mr-2" />
                  Sua Meta Diária
                </h2>
                <p className="text-2xl sm:text-3xl font-bold text-primary" data-testid="text-meta-progresso">
                  {completedToday}/{META_DIARIA} tarefas concluídas
                </p>
              </div>
              <div className="text-left sm:text-right">
                {completedToday >= META_DIARIA ? (
                  <Badge className="bg-green-500 text-white text-xs sm:text-sm px-2 sm:px-3 py-1">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    Meta Atingida!
                  </Badge>
                ) : (
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Faltam {META_DIARIA - completedToday} tarefas
                  </span>
                )}
              </div>
            </div>
            <Progress value={progresso} className="h-2 sm:h-3" data-testid="progress-meta" />
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="grid w-full sm:w-auto grid-cols-4">
              <TabsTrigger value="today" data-testid="tab-hoje">Hoje</TabsTrigger>
              <TabsTrigger value="week" data-testid="tab-semana">Semana</TabsTrigger>
              <TabsTrigger value="month" data-testid="tab-mes">Mês</TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-concluidas">Concluídas</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="filter-tipo">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(taskTypeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {tasksLoading ? (
              <>
                <TaskSkeleton />
                <TaskSkeleton />
                <TaskSkeleton />
              </>
            ) : filteredTasks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    {activeTab === 'completed' ? (
                      <>
                        <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                          <CheckCircle className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-600">Nenhuma tarefa concluída</h3>
                        <p className="text-muted-foreground mt-2">
                          Comece marcando tarefas como feitas para vê-las aqui.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                          <Check className="h-8 w-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-green-600">Tudo em dia!</h3>
                        <p className="text-muted-foreground mt-2">
                          Não há tarefas pendentes para este período. Excelente trabalho!
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              filteredTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onComplete={(id) => completeMutation.mutate(id)}
                  isUpdating={updatingTaskId === task.id}
                  showActions={!isCompletedTab}
                />
              ))
            )}
          </AnimatePresence>
        </div>

        {!tasksLoading && filteredTasks.length > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            Mostrando {filteredTasks.length} {filteredTasks.length === 1 ? 'tarefa' : 'tarefas'}
          </div>
        )}
      </div>
    </Layout>
  );
}
