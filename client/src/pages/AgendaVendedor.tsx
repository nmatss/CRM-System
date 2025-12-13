import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Clock,
  AlertTriangle,
  CheckCircle,
  ListTodo,
  User,
  TrendingUp,
  Target,
  Sparkles,
  Star,
  DollarSign,
  Users,
  CalendarDays,
  Flame,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Zap,
  Heart,
  PhoneCall,
  Mail,
  ChevronRight,
  Eye,
  History
} from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { SellerTask, Customer, SellerGoal, CustomerInteraction } from "@shared/schema";
import { Trophy, Settings2, MessageSquare } from "lucide-react";

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

interface SellerRankingItem {
  sellerId: string;
  sellerName: string;
  completedTasks: number;
  totalInteractions: number;
}

interface DashboardData {
  birthdaysToday: Customer[];
  birthdaysWeek: Customer[];
  vipCustomers: Customer[];
  recentPurchases: Customer[];
  dormantCustomers: Customer[];
  todayTasks: TaskWithCustomer[];
  weekTasks: TaskWithCustomer[];
  completedThisWeek: number;
  totalSalesThisMonth: number;
  avgTicket: number;
  conversionRate: number;
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getDaysAgo(dateStr: string | null | undefined): number {
  if (!dateStr) return 999;
  const date = new Date(dateStr);
  const today = new Date();
  const diffTime = today.getTime() - date.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function parseCurrencyToNumber(value: string | null | undefined): number {
  if (!value) return 0;
  // Remove currency symbols and spaces, then handle Brazilian format (1.234,56)
  // First strip thousands separator (.), then replace decimal comma with dot
  const cleaned = value
    .replace(/[R$\s]/g, '')     // Remove currency symbol and spaces
    .replace(/\./g, '')          // Remove thousands separator (periods)
    .replace(',', '.');          // Replace decimal comma with dot
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function formatLTV(value: string | null | undefined): string {
  const num = parseCurrencyToNumber(value);
  return formatCurrency(num);
}

function QuickStatCard({ 
  title, 
  value, 
  subtitle,
  icon, 
  trend,
  trendValue,
  color,
  onClick
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: React.ReactNode; 
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        className={`relative overflow-hidden cursor-pointer transition-shadow hover:shadow-lg ${color}`}
        onClick={onClick}
        data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}
      >
        <div className="absolute top-0 right-0 w-20 h-20 opacity-10">
          {icon}
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <div className={`p-2 rounded-lg ${color.includes('bg-') ? 'bg-white/50' : 'bg-primary/10'}`}>
              {icon}
            </div>
          </div>
          {trend && trendValue && (
            <div className="flex items-center gap-1 mt-2">
              {trend === 'up' ? (
                <ArrowUpRight className="h-3 w-3 text-green-600" />
              ) : trend === 'down' ? (
                <ArrowDownRight className="h-3 w-3 text-red-600" />
              ) : null}
              <span className={`text-xs font-medium ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'}`}>
                {trendValue}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function BirthdayCard({ customer, onContact }: { customer: Customer; onContact: (customer: Customer) => void }) {
  const isToday = customer.birthDate && new Date(customer.birthDate).getDate() === new Date().getDate() && 
                  new Date(customer.birthDate).getMonth() === new Date().getMonth();
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-100"
    >
      <div className="relative">
        <Avatar className="h-10 w-10 ring-2 ring-pink-300">
          <AvatarImage src={customer.image || ''} alt={customer.name} />
          <AvatarFallback className="bg-pink-100 text-pink-700 font-semibold">
            {customer.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        {isToday && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
            <span className="animate-ping absolute h-full w-full rounded-full bg-pink-400 opacity-75"></span>
            <Gift className="h-3 w-3 text-pink-600 relative" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{customer.name}</p>
        <p className="text-xs text-muted-foreground">
          {isToday ? (
            <span className="text-pink-600 font-medium flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Hoje!
            </span>
          ) : (
            customer.birthDate && new Date(customer.birthDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
          )}
        </p>
      </div>
      <Button 
        size="sm" 
        variant="ghost" 
        className="h-8 w-8 p-0 text-pink-600 hover:bg-pink-100"
        onClick={() => onContact(customer)}
        data-testid={`button-birthday-contact-${customer.id}`}
      >
        <MessageCircle className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}

function VIPCustomerCard({ customer, onContact }: { customer: Customer; onContact: (customer: Customer) => void }) {
  const daysAgo = getDaysAgo(customer.lastPurchase);
  const isAtRisk = daysAgo > 60;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isAtRisk ? 'bg-amber-50 border-amber-200' : 'bg-purple-50/50 border-purple-100'
      }`}
    >
      <div className="relative">
        <Avatar className="h-10 w-10 ring-2 ring-purple-300">
          <AvatarImage src={customer.image || ''} alt={customer.name} />
          <AvatarFallback className="bg-purple-100 text-purple-700 font-semibold">
            {customer.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <Crown className="absolute -top-1 -right-1 h-4 w-4 text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{customer.name}</p>
          {isAtRisk && (
            <Badge variant="destructive" className="text-[10px] h-4 px-1">
              <AlertTriangle className="h-2 w-2 mr-0.5" />
              Risco
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-green-600 font-medium">{formatLTV(customer.ltv)}</span>
          <span>•</span>
          <span>{daysAgo > 0 ? `${daysAgo}d sem comprar` : 'Comprou hoje'}</span>
        </div>
      </div>
      <div className="flex gap-1">
        <Button 
          size="sm" 
          variant="ghost" 
          className="h-8 w-8 p-0"
          onClick={() => onContact(customer)}
          data-testid={`button-vip-contact-${customer.id}`}
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function TaskMiniCard({ 
  task, 
  onComplete, 
  isUpdating 
}: { 
  task: TaskWithCustomer; 
  onComplete: (id: number) => void;
  isUpdating: boolean;
}) {
  const config = taskTypeConfig[task.type as TaskType] || taskTypeConfig.manual;
  const isOverdue = task.dueDate < new Date().toISOString().split('T')[0] && task.status === 'pending';

  const handleWhatsApp = () => {
    if (!task.customer?.phone || !task.script) return;
    const texto = encodeURIComponent(task.script);
    window.open(`https://wa.me/${task.customer.phone.replace(/\D/g, '')}?text=${texto}`, "_blank");
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`p-3 rounded-lg border transition-all ${
        isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 hover:border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={task.customer?.image || ''} alt={task.customer?.name || 'Cliente'} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
            {task.customer?.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || 'CL'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{task.customer?.name || 'Tarefa'}</p>
            {isOverdue && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge className={`${config.color} text-white text-[10px] h-4 px-1.5 gap-0.5`}>
              {config.icon}
              {config.label}
            </Badge>
          </div>
        </div>
        <div className="flex gap-1">
          {task.customer?.phone && task.script && (
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 w-7 p-0 text-green-600"
              onClick={handleWhatsApp}
            >
              <Phone className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 w-7 p-0 text-primary"
            onClick={() => onComplete(task.id)}
            disabled={isUpdating}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function PerformanceGoalCard({ 
  title, 
  current, 
  goal, 
  icon, 
  color 
}: { 
  title: string; 
  current: number; 
  goal: number; 
  icon: React.ReactNode; 
  color: string;
}) {
  const percentage = Math.min((current / goal) * 100, 100);
  const isCompleted = current >= goal;
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${color}`}>
              {icon}
            </div>
            <span className="text-sm font-medium">{title}</span>
          </div>
          {isCompleted && (
            <Badge className="bg-green-500 text-white text-[10px]">
              <Award className="h-3 w-3 mr-0.5" />
              Meta!
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold">{current}</span>
            <span className="text-sm text-muted-foreground">de {goal}</span>
          </div>
          <Progress value={percentage} className={`h-2 ${isCompleted ? '[&>div]:bg-green-500' : ''}`} />
          <p className="text-xs text-muted-foreground">
            {isCompleted ? 'Parabéns! Meta atingida!' : `Faltam ${goal - current} para a meta`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function GoalsSettingsDialog({ 
  goals, 
  onSaveGoals,
  isManager
}: { 
  goals: SellerGoal | null;
  onSaveGoals: (data: any) => void;
  isManager: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    dailyTaskGoal: goals?.dailyTaskGoal || 10,
    weeklyTaskGoal: goals?.weeklyTaskGoal || 50,
    monthlyTaskGoal: goals?.monthlyTaskGoal || 200,
  });

  if (!isManager) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveGoals(formData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-config-metas">
          <Settings2 className="h-4 w-4" />
          Metas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Configurar Metas
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="dailyGoal">Meta Diária de Tarefas</Label>
            <Input
              id="dailyGoal"
              type="number"
              min="1"
              value={formData.dailyTaskGoal}
              onChange={(e) => setFormData({...formData, dailyTaskGoal: parseInt(e.target.value) || 10})}
              data-testid="input-meta-diaria"
            />
          </div>
          <div>
            <Label htmlFor="weeklyGoal">Meta Semanal de Tarefas</Label>
            <Input
              id="weeklyGoal"
              type="number"
              min="1"
              value={formData.weeklyTaskGoal}
              onChange={(e) => setFormData({...formData, weeklyTaskGoal: parseInt(e.target.value) || 50})}
              data-testid="input-meta-semanal"
            />
          </div>
          <div>
            <Label htmlFor="monthlyGoal">Meta Mensal de Tarefas</Label>
            <Input
              id="monthlyGoal"
              type="number"
              min="1"
              value={formData.monthlyTaskGoal}
              onChange={(e) => setFormData({...formData, monthlyTaskGoal: parseInt(e.target.value) || 200})}
              data-testid="input-meta-mensal"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" data-testid="button-salvar-metas">
              Salvar Metas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RankingCard({ ranking, currentUserId }: { ranking: SellerRankingItem[]; currentUserId?: string }) {
  const getMedalColor = (index: number) => {
    switch (index) {
      case 0: return "text-yellow-500";
      case 1: return "text-gray-400";
      case 2: return "text-amber-600";
      default: return "text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Ranking de Vendedores
        </CardTitle>
        <CardDescription className="text-xs">Tarefas concluídas esta semana</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum ranking disponível
          </p>
        ) : (
          ranking.slice(0, 5).map((seller, index) => (
            <motion.div
              key={seller.sellerId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center gap-3 p-2 rounded-lg ${
                seller.sellerId === currentUserId ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
              }`}
            >
              <div className={`text-lg font-bold w-6 ${getMedalColor(index)}`}>
                {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {seller.sellerName}
                  {seller.sellerId === currentUserId && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">Você</Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {seller.completedTasks} tarefas • {seller.totalInteractions} interações
                </p>
              </div>
            </motion.div>
          ))
        )}
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
  const [formData, setFormData] = useState({
    customerId: '',
    type: 'manual',
    dueDate: new Date().toISOString().split('T')[0],
    script: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
        <Button className="gap-2 shadow-lg" data-testid="button-nova-tarefa">
          <Plus className="h-4 w-4" />
          Nova Tarefa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            Criar Nova Tarefa
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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

function TaskCard({ 
  task, 
  onComplete, 
  isUpdating,
}: { 
  task: TaskWithCustomer; 
  onComplete: (id: number) => void;
  isUpdating: boolean;
}) {
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const config = taskTypeConfig[task.type as TaskType] || taskTypeConfig.manual;
  const isCompleted = task.status === 'completed';
  const isOverdue = task.dueDate < new Date().toISOString().split('T')[0] && task.status === 'pending';

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -300 }}
    >
      <Card className={`overflow-hidden transition-all ${
        isOverdue ? 'border-red-300 bg-red-50/30 shadow-red-100' : 
        isCompleted ? 'border-green-200 bg-green-50/30' : 
        'hover:shadow-md'
      }`} data-testid={`card-tarefa-${task.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 ring-2 ring-offset-2 ring-primary/20">
              <AvatarImage src={task.customer?.image || ''} alt={task.customer?.name || 'Cliente'} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {task.customer?.name?.split(" ").map(n => n[0]).join("").slice(0, 2) || 'CL'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base">{task.customer?.name || 'Cliente'}</h3>
                {isCompleted && (
                  <Badge className="bg-green-500 text-white gap-1 text-xs">
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
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge className={`${config.color} text-white gap-1`}>
                  {config.icon}
                  {config.label}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          {task.customer && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Última Compra</p>
                <p className="text-sm font-semibold mt-0.5">
                  {task.customer.lastPurchase ? `${getDaysAgo(task.customer.lastPurchase)}d atrás` : 'N/A'}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">LTV</p>
                <p className="text-sm font-semibold text-green-600 mt-0.5">{formatLTV(task.customer.ltv)}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Segmento</p>
                <p className="text-sm font-semibold capitalize mt-0.5">{task.customer.segment || 'Novo'}</p>
              </div>
            </div>
          )}

          {task.notes && (
            <div className="mt-3 p-2 bg-blue-50 rounded-lg text-sm border border-blue-100">
              <span className="text-blue-600 font-medium">Notas: </span>
              <span className="text-blue-800">{task.notes}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {task.script && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScriptExpanded(!scriptExpanded)}
                className="gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Ver Script
                {scriptExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}

            {!isCompleted && (
              <>
                {task.customer?.phone && task.script && (
                  <Button
                    size="sm"
                    onClick={handleWhatsApp}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Phone className="h-4 w-4" />
                    WhatsApp
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onComplete(task.id)}
                  disabled={isUpdating}
                  className="gap-2 text-green-600 border-green-600 hover:bg-green-50"
                >
                  <Check className="h-4 w-4" />
                  {isUpdating ? 'Salvando...' : 'Concluir'}
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
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700">Sugestão de Mensagem</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyScript}
                      className="gap-2 h-7 text-blue-600"
                    >
                      <Copy className="h-3 w-3" />
                      {copied ? "Copiado!" : "Copiar"}
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-700">{task.script}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function AgendaVendedor() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const { data: todayTasks = [], isLoading: todayLoading } = useQuery<TaskWithCustomer[]>({
    queryKey: ['/api/seller-tasks', 'today'],
    queryFn: async () => {
      const params = new URLSearchParams({ dateFrom: today, dateTo: today, status: 'pending' });
      const res = await fetch(`/api/seller-tasks?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: weekTasks = [] } = useQuery<TaskWithCustomer[]>({
    queryKey: ['/api/seller-tasks', 'week'],
    queryFn: async () => {
      const params = new URLSearchParams({ dateFrom: today, dateTo: weekEndStr, status: 'pending' });
      const res = await fetch(`/api/seller-tasks?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: completedTasks = [] } = useQuery<TaskWithCustomer[]>({
    queryKey: ['/api/seller-tasks', 'completed'],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'completed' });
      const res = await fetch(`/api/seller-tasks?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: stats, isLoading: statsLoading } = useQuery<SellerStats>({
    queryKey: ['/api/seller-tasks/stats'],
    queryFn: async () => {
      const res = await fetch('/api/seller-tasks/stats', { credentials: 'include' });
      if (!res.ok) return { pending: 0, completed: 0, today: 0, overdue: 0 };
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

  const { data: goals } = useQuery<SellerGoal>({
    queryKey: ['/api/seller-goals'],
    queryFn: async () => {
      const res = await fetch('/api/seller-goals', { credentials: 'include' });
      if (!res.ok) return { dailyTaskGoal: 10, weeklyTaskGoal: 50, monthlyTaskGoal: 200 };
      return res.json();
    }
  });

  const { data: ranking = [] } = useQuery<SellerRankingItem[]>({
    queryKey: ['/api/seller-ranking'],
    queryFn: async () => {
      const res = await fetch('/api/seller-ranking?period=weekly', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: recentInteractions = [] } = useQuery<CustomerInteraction[]>({
    queryKey: ['/api/customer-interactions'],
    queryFn: async () => {
      const res = await fetch('/api/customer-interactions?limit=10', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const goalsMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/seller-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Falha ao salvar metas');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seller-goals'] });
    }
  });

  const dashboardData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();
    
    const birthdaysToday = customers.filter(c => {
      if (!c.birthDate) return false;
      const bd = new Date(c.birthDate);
      return bd.getDate() === currentDay && bd.getMonth() === currentMonth;
    });

    const birthdaysWeek = customers.filter(c => {
      if (!c.birthDate) return false;
      const bd = new Date(c.birthDate);
      const bdThisYear = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
      const diffDays = Math.ceil((bdThisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= 7;
    });

    const vipCustomers = customers
      .filter(c => c.segment === 'vip' || c.segment === 'premium')
      .sort((a, b) => {
        const ltvA = parseCurrencyToNumber(a.ltv);
        const ltvB = parseCurrencyToNumber(b.ltv);
        return ltvB - ltvA;
      })
      .slice(0, 5);

    const dormantCustomers = customers
      .filter(c => {
        const days = getDaysAgo(c.lastPurchase);
        return days > 30 && days < 999;
      })
      .sort((a, b) => getDaysAgo(b.lastPurchase) - getDaysAgo(a.lastPurchase))
      .slice(0, 5);

    const recentPurchases = customers
      .filter(c => getDaysAgo(c.lastPurchase) <= 7)
      .slice(0, 5);

    return {
      birthdaysToday,
      birthdaysWeek,
      vipCustomers,
      dormantCustomers,
      recentPurchases,
    };
  }, [customers]);

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
    onMutate: (taskId) => setUpdatingTaskId(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes('seller-tasks') });
    },
    onSettled: () => setUpdatingTaskId(null)
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
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes('seller-tasks') });
    }
  });

  const handleContactCustomer = (customer: Customer) => {
    if (customer.phone) {
      const msg = encodeURIComponent(`Olá ${customer.name?.split(' ')[0]}!`);
      window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${msg}`, "_blank");
    }
  };

  const META_DIARIA = goals?.dailyTaskGoal || 10;
  const META_SEMANAL = goals?.weeklyTaskGoal || 50;
  const isManager = user?.role === 'manager' || user?.isSuperAdmin;
  const completedToday = stats?.completed || 0;
  const completedWeek = completedTasks.filter(t => {
    const completedDate = new Date(t.completedAt || '');
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return completedDate >= weekAgo;
  }).length;

  const overdueTasks = weekTasks.filter(t => t.dueDate < today);

  const filteredTasks = useMemo(() => {
    const tasksToFilter = activeTab === 'completed' ? completedTasks : 
                         activeTab === 'week' ? weekTasks : todayTasks;
    if (typeFilter === 'all') return tasksToFilter;
    return tasksToFilter.filter(t => t.type === typeFilter);
  }, [activeTab, typeFilter, todayTasks, weekTasks, completedTasks]);

  return (
    <Layout>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-purple-600 shadow-lg shadow-primary/25">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {getGreeting()}, {user?.name?.split(' ')[0] || 'Vendedor'}!
                </h1>
                <p className="text-muted-foreground">
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </motion.div>
          </div>
          <div className="flex items-center gap-2">
            <GoalsSettingsDialog 
              goals={goals || null} 
              onSaveGoals={goalsMutation.mutate} 
              isManager={isManager} 
            />
            <NewTaskDialog customers={customers} onCreateTask={createMutation.mutate} />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickStatCard
            title="Tarefas Hoje"
            value={stats?.today || 0}
            subtitle={`${completedToday} concluídas`}
            icon={<Target className="h-5 w-5 text-blue-600" />}
            color="bg-blue-50"
            trend={completedToday >= META_DIARIA ? 'up' : 'neutral'}
            trendValue={completedToday >= META_DIARIA ? 'Meta atingida!' : `Meta: ${META_DIARIA}`}
          />
          <QuickStatCard
            title="Pendentes"
            value={stats?.pending || 0}
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            color="bg-amber-50"
          />
          <QuickStatCard
            title="Atrasadas"
            value={stats?.overdue || 0}
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            color="bg-red-50"
            trend={stats?.overdue && stats.overdue > 0 ? 'down' : 'neutral'}
            trendValue={stats?.overdue && stats.overdue > 0 ? 'Atenção!' : 'Tudo em dia'}
          />
          <QuickStatCard
            title="Aniversariantes"
            value={dashboardData.birthdaysToday.length}
            subtitle={`+${dashboardData.birthdaysWeek.length} esta semana`}
            icon={<Gift className="h-5 w-5 text-pink-600" />}
            color="bg-pink-50"
          />
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Tasks */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <TabsList>
                  <TabsTrigger value="overview" className="gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    Visão Geral
                  </TabsTrigger>
                  <TabsTrigger value="today" className="gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    Hoje
                    {todayTasks.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5">{todayTasks.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="week" className="gap-1.5">
                    <Calendar className="h-4 w-4" />
                    Semana
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="gap-1.5">
                    <CheckCircle className="h-4 w-4" />
                    Concluídas
                  </TabsTrigger>
                </TabsList>

                {activeTab !== 'overview' && (
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {Object.entries(taskTypeConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <TabsContent value="overview" className="mt-4 space-y-6">
                {/* Performance Goals */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <PerformanceGoalCard
                    title="Meta Diária"
                    current={completedToday}
                    goal={META_DIARIA}
                    icon={<Flame className="h-4 w-4 text-orange-600" />}
                    color="bg-orange-100"
                  />
                  <PerformanceGoalCard
                    title="Meta Semanal"
                    current={completedWeek}
                    goal={META_SEMANAL}
                    icon={<TrendingUp className="h-4 w-4 text-green-600" />}
                    color="bg-green-100"
                  />
                </div>

                {/* Today's Priority Tasks */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Prioridades de Hoje
                      </CardTitle>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveTab('today')}>
                        Ver todas <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {todayLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-16" />
                        <Skeleton className="h-16" />
                      </div>
                    ) : todayTasks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                        <p className="font-medium">Parabéns!</p>
                        <p className="text-sm">Todas as tarefas de hoje foram concluídas.</p>
                      </div>
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {todayTasks.slice(0, 3).map((task) => (
                          <TaskMiniCard
                            key={task.id}
                            task={task}
                            onComplete={completeMutation.mutate}
                            isUpdating={updatingTaskId === task.id}
                          />
                        ))}
                      </AnimatePresence>
                    )}
                    {todayTasks.length > 3 && (
                      <Button 
                        variant="outline" 
                        className="w-full mt-2" 
                        size="sm"
                        onClick={() => setActiveTab('today')}
                      >
                        Ver mais {todayTasks.length - 3} tarefas
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Overdue Alert */}
                {overdueTasks.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Card className="border-red-200 bg-red-50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-red-100">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-red-800">Atenção! Tarefas atrasadas</p>
                            <p className="text-sm text-red-600">
                              Você tem {overdueTasks.length} tarefa(s) que precisam de atenção urgente.
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => setActiveTab('week')}
                          >
                            Ver agora
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </TabsContent>

              <TabsContent value="today" className="mt-4">
                <div className="space-y-3">
                  {todayLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-40" />
                      <Skeleton className="h-40" />
                    </div>
                  ) : filteredTasks.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                        <h3 className="font-semibold text-lg">Tudo limpo!</h3>
                        <p className="text-muted-foreground mt-1">Nenhuma tarefa pendente para hoje.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {filteredTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={completeMutation.mutate}
                          isUpdating={updatingTaskId === task.id}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="week" className="mt-4">
                <div className="space-y-3">
                  {filteredTasks.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Calendar className="h-12 w-12 mx-auto mb-3 text-blue-500" />
                        <h3 className="font-semibold text-lg">Semana tranquila!</h3>
                        <p className="text-muted-foreground mt-1">Nenhuma tarefa pendente para esta semana.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {filteredTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={completeMutation.mutate}
                          isUpdating={updatingTaskId === task.id}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="completed" className="mt-4">
                <div className="space-y-3">
                  {filteredTasks.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <History className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                        <h3 className="font-semibold text-lg">Nenhuma tarefa concluída</h3>
                        <p className="text-muted-foreground mt-1">Complete suas primeiras tarefas para ver o histórico.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {filteredTasks.slice(0, 10).map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={() => {}}
                          isUpdating={false}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Insights */}
          <div className="space-y-4">
            {/* Birthdays */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-4 w-4 text-pink-500" />
                  Aniversariantes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboardData.birthdaysToday.length === 0 && dashboardData.birthdaysWeek.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum aniversário próximo
                  </p>
                ) : (
                  <>
                    {dashboardData.birthdaysToday.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-pink-600 uppercase tracking-wide">Hoje</p>
                        {dashboardData.birthdaysToday.map(customer => (
                          <BirthdayCard key={customer.id} customer={customer} onContact={handleContactCustomer} />
                        ))}
                      </div>
                    )}
                    {dashboardData.birthdaysWeek.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Esta Semana</p>
                        {dashboardData.birthdaysWeek.map(customer => (
                          <BirthdayCard key={customer.id} customer={customer} onContact={handleContactCustomer} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Seller Ranking */}
            <RankingCard ranking={ranking} currentUserId={user?.id} />

            {/* VIP Customers */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="h-4 w-4 text-purple-500" />
                  Clientes VIP
                </CardTitle>
                <CardDescription className="text-xs">Top clientes por valor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboardData.vipCustomers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum cliente VIP cadastrado
                  </p>
                ) : (
                  dashboardData.vipCustomers.map(customer => (
                    <VIPCustomerCard key={customer.id} customer={customer} onContact={handleContactCustomer} />
                  ))
                )}
              </CardContent>
            </Card>

            {/* Dormant Customers Alert */}
            {dashboardData.dormantCustomers.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                    <Clock className="h-4 w-4" />
                    Clientes Inativos
                  </CardTitle>
                  <CardDescription className="text-xs text-amber-600">
                    Há mais de 30 dias sem comprar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dashboardData.dormantCustomers.map(customer => (
                    <div 
                      key={customer.id}
                      className="flex items-center gap-2 p-2 rounded bg-white/80"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-amber-100 text-amber-700">
                          {customer.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{customer.name}</p>
                        <p className="text-xs text-amber-600">{getDaysAgo(customer.lastPurchase)}d sem comprar</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0"
                        onClick={() => handleContactCustomer(customer)}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Ações Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="h-auto py-3 flex-col gap-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Clientes</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto py-3 flex-col gap-1">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="text-xs">Vendas</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto py-3 flex-col gap-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs">Relatórios</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto py-3 flex-col gap-1">
                  <Mail className="h-4 w-4" />
                  <span className="text-xs">Campanhas</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
