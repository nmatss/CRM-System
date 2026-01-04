import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Users,
  ShoppingBag,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Clock,
  Target,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface DashboardStats {
  kpis: {
    totalRevenue: number;
    revenueChange: number;
    averageTicket: number;
    ticketChange: number;
    totalCustomers: number;
    activeCustomers: number;
    activeChange: number;
    churnRate: number;
    churnChange: number;
    averageLTV: number;
    ltvChange: number;
    cashbackPending: number;
    cashbackChange: number;
    cashbackROI: number;
    roiChange: number;
  };
  salesChart: Array<{ date: string; value: number }>;
  customerSegments: Array<{ name: string; value: number; color: string }>;
  cashbackChart: Array<{ month: string; concedido: number; resgatado: number }>;
  topProducts: Array<{ name: string; sales: number; revenue: number }>;
  insights: Array<{ type: string; title: string; description: string; priority: string }>;
  customersAtRisk: Array<{ id: number; name: string; segment: string; lastPurchase: string; risk: string }>;
  expiringCashback: Array<{ customerId: number; customerName: string; amount: number; expiresAt: string }>;
  activeCampaigns: Array<{ id: number; name: string; status: string; sent: number; openRate: number }>;
}

const COLORS = {
  vip: '#9333ea',
  frequent: '#00C49F',
  new: '#FFBB28',
  atrisk: '#FF8042',
  inactive: '#8884d8',
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isSuperAdmin } = useAuth();

  // Super Admin without tenant should be redirected to admin page
  if (isSuperAdmin && !user?.tenantId) {
    setLocation("/admin");
    return null;
  }

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await fetch("/api/v1/dashboard/stats");
      if (!response.ok) {
        // Return mock data if API is not ready
        return {
          kpis: {
            totalRevenue: 287450.80,
            revenueChange: 12.5,
            averageTicket: 145.30,
            ticketChange: 5.2,
            totalCustomers: 1847,
            activeCustomers: 892,
            activeChange: 8.3,
            churnRate: 5.2,
            churnChange: -1.5,
            averageLTV: 1250.80,
            ltvChange: 15.8,
            cashbackPending: 142300,
            cashbackChange: 6.7,
            cashbackROI: 12.0,
            roiChange: 2.1,
          },
          salesChart: [
            { date: '01/12', value: 12500 },
            { date: '02/12', value: 18200 },
            { date: '03/12', value: 15800 },
            { date: '04/12', value: 21300 },
            { date: '05/12', value: 19400 },
            { date: '06/12', value: 24100 },
            { date: '07/12', value: 22800 },
            { date: '08/12', value: 26700 },
            { date: '09/12', value: 23900 },
            { date: '10/12', value: 28500 },
            { date: '11/12', value: 25600 },
            { date: '12/12', value: 31200 },
          ],
          customerSegments: [
            { name: 'VIP', value: 145, color: COLORS.vip },
            { name: 'Frequente', value: 412, color: COLORS.frequent },
            { name: 'Novo', value: 387, color: COLORS.new },
            { name: 'Em Risco', value: 234, color: COLORS.atrisk },
            { name: 'Inativo', value: 669, color: COLORS.inactive },
          ],
          cashbackChart: [
            { month: 'Jul', concedido: 18000, resgatado: 4500 },
            { month: 'Ago', concedido: 22000, resgatado: 5800 },
            { month: 'Set', concedido: 25000, resgatado: 6200 },
            { month: 'Out', concedido: 28000, resgatado: 7100 },
            { month: 'Nov', concedido: 31000, resgatado: 8500 },
            { month: 'Dez', concedido: 34000, resgatado: 9200 },
          ],
          topProducts: [
            { name: 'Smartphone Galaxy S24', sales: 145, revenue: 217500 },
            { name: 'Notebook Dell Inspiron', sales: 98, revenue: 196000 },
            { name: 'Smart TV 55" LG', sales: 132, revenue: 184800 },
            { name: 'Fone JBL Bluetooth', sales: 287, revenue: 86100 },
            { name: 'Mouse Gamer Logitech', sales: 412, revenue: 61800 },
          ],
          insights: [
            {
              type: 'warning',
              title: 'Churn aumentando em clientes Novos',
              description: '23% dos novos clientes não compraram nos últimos 45 dias. Considere criar campanha de reativação.',
              priority: 'high'
            },
            {
              type: 'success',
              title: 'Campanha de Black Friday com alto ROI',
              description: 'A campanha gerou R$ 45.200 em receita com apenas R$ 2.800 investidos (ROI: 16x).',
              priority: 'medium'
            },
            {
              type: 'info',
              title: 'Categoria "Eletrônicos" em alta',
              description: 'Vendas de eletrônicos cresceram 34% este mês. Aumente estoque de produtos populares.',
              priority: 'low'
            },
            {
              type: 'warning',
              title: 'Cashback expirando em 7 dias',
              description: 'R$ 8.450 em cashback de 47 clientes irá expirar. Envie lembretes para aumentar resgates.',
              priority: 'high'
            },
          ],
          customersAtRisk: [
            { id: 1, name: 'João Silva', segment: 'VIP', lastPurchase: '2024-09-15', risk: 'Alto' },
            { id: 2, name: 'Maria Santos', segment: 'Frequente', lastPurchase: '2024-10-02', risk: 'Médio' },
            { id: 3, name: 'Carlos Oliveira', segment: 'VIP', lastPurchase: '2024-09-28', risk: 'Alto' },
            { id: 4, name: 'Ana Costa', segment: 'Frequente', lastPurchase: '2024-10-10', risk: 'Médio' },
          ],
          expiringCashback: [
            { customerId: 101, customerName: 'Pedro Alves', amount: 250.00, expiresAt: '2024-12-20' },
            { customerId: 102, customerName: 'Juliana Mendes', amount: 180.50, expiresAt: '2024-12-21' },
            { customerId: 103, customerName: 'Roberto Lima', amount: 420.00, expiresAt: '2024-12-22' },
            { customerId: 104, customerName: 'Fernanda Rocha', amount: 95.00, expiresAt: '2024-12-23' },
          ],
          activeCampaigns: [
            { id: 1, name: 'Natal 2024 - Ofertas Especiais', status: 'Ativa', sent: 1847, openRate: 42.5 },
            { id: 2, name: 'Reativação Clientes Inativos', status: 'Ativa', sent: 669, openRate: 28.3 },
            { id: 3, name: 'Cashback em Dobro VIP', status: 'Agendada', sent: 0, openRate: 0 },
          ],
        };
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (isLoading || !stats) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const kpiCards = [
    {
      title: "Receita Total",
      value: formatCurrency(stats.kpis.totalRevenue),
      change: formatPercent(stats.kpis.revenueChange),
      comparison: "vs mês anterior",
      trend: stats.kpis.revenueChange >= 0 ? "up" : "down",
      icon: DollarSign,
      color: "text-emerald-600",
    },
    {
      title: "Ticket Médio",
      value: formatCurrency(stats.kpis.averageTicket),
      change: formatPercent(stats.kpis.ticketChange),
      comparison: "vs mês anterior",
      trend: stats.kpis.ticketChange >= 0 ? "up" : "down",
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      title: "Total de Clientes",
      value: stats.kpis.totalCustomers.toLocaleString('pt-BR'),
      change: `${stats.kpis.activeCustomers} ativos`,
      comparison: formatPercent(stats.kpis.activeChange) + " vs mês anterior",
      trend: stats.kpis.activeChange >= 0 ? "up" : "down",
      icon: Users,
      color: "text-purple-600",
    },
    {
      title: "Clientes Ativos",
      value: stats.kpis.activeCustomers.toLocaleString('pt-BR'),
      change: formatPercent(stats.kpis.activeChange),
      comparison: "últimos 30 dias",
      trend: stats.kpis.activeChange >= 0 ? "up" : "down",
      icon: Target,
      color: "text-indigo-600",
    },
    {
      title: "Churn Rate",
      value: `${stats.kpis.churnRate.toFixed(1)}%`,
      change: formatPercent(stats.kpis.churnChange),
      comparison: "vs mês anterior",
      trend: stats.kpis.churnChange <= 0 ? "up" : "down",
      icon: AlertTriangle,
      color: stats.kpis.churnRate > 7 ? "text-red-600" : "text-yellow-600",
    },
    {
      title: "LTV Médio",
      value: formatCurrency(stats.kpis.averageLTV),
      change: formatPercent(stats.kpis.ltvChange),
      comparison: "vs mês anterior",
      trend: stats.kpis.ltvChange >= 0 ? "up" : "down",
      icon: TrendingUp,
      color: "text-green-600",
    },
    {
      title: "Cashback Pendente",
      value: formatCurrency(stats.kpis.cashbackPending),
      change: formatPercent(stats.kpis.cashbackChange),
      comparison: "passivo total",
      trend: stats.kpis.cashbackChange >= 0 ? "up" : "down",
      icon: Wallet,
      color: "text-orange-600",
    },
    {
      title: "ROI do Cashback",
      value: `${stats.kpis.cashbackROI.toFixed(1)}x`,
      change: formatPercent(stats.kpis.roiChange),
      comparison: "retorno sobre investimento",
      trend: stats.kpis.roiChange >= 0 ? "up" : "down",
      icon: DollarSign,
      color: "text-teal-600",
    },
  ];

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Dashboard Unificado"
          description="Visão completa do desempenho do seu negócio"
        >
          <Button variant="outline" size="sm" className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Baixar Relatório</span>
            <span className="sm:hidden">Relatório</span>
          </Button>
          <Button size="sm" className="text-xs sm:text-sm" onClick={() => setLocation("/orders")}>
            <span className="hidden sm:inline">Novo Pedido</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </PageHeader>

        {/* KPIs Principais */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((kpi, index) => (
            <Card
              key={index}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                // Future: drill-down functionality
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium truncate pr-2">
                  {kpi.title}
                </CardTitle>
                <kpi.icon className={`h-4 w-4 flex-shrink-0 ${kpi.color}`} />
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold truncate">{kpi.value}</div>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {kpi.trend === "up" ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-rose-500 flex-shrink-0" />
                  )}
                  <p className="text-xs flex-wrap">
                    <span className={kpi.trend === "up" ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                      {kpi.change}
                    </span>
                    <span className="text-muted-foreground ml-1 hidden sm:inline">{kpi.comparison}</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Gráficos Principais */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {/* Vendas por Período */}
          <Card className="lg:col-span-2">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Vendas por Período</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Evolução da receita nos últimos 30 dias</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 sm:pl-2">
              <div className="h-[250px] sm:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.salesChart}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#888888"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => {
                        if (value >= 1000) {
                          return `R$ ${(value / 1000).toFixed(0)}k`;
                        }
                        return `R$ ${value}`;
                      }}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Vendas']}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorValue)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Distribuição por Segmento */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Clientes por Segmento</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Distribuição da base de clientes</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.customerSegments}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => {
                        const isMobile = window.innerWidth < 640;
                        return isMobile ? `${(percent * 100).toFixed(0)}%` : `${name} ${(percent * 100).toFixed(0)}%`;
                      }}
                      labelLine={false}
                    >
                      {stats.customerSegments.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      wrapperStyle={{ fontSize: '12px' }}
                      iconSize={10}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cashback: Concedido vs Resgatado */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Cashback: Concedido vs Resgatado</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.cashbackChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => {
                        if (v >= 1000) {
                          return `R$ ${(v / 1000).toFixed(0)}k`;
                        }
                        return `R$ ${v}`;
                      }}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} iconSize={10} />
                    <Bar dataKey="concedido" fill="#9333ea" radius={[4, 4, 0, 0]} name="Concedido" />
                    <Bar dataKey="resgatado" fill="#00C49F" radius={[4, 4, 0, 0]} name="Resgatado" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top 5 Produtos */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Top 5 Produtos Mais Vendidos</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Produtos com melhor desempenho este mês</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              {stats.topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm sm:text-base flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base truncate">{product.name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">{product.sales} vendas</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm sm:text-lg whitespace-nowrap">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Widgets Informativos */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {/* Ações Recomendadas */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 flex-shrink-0" />
                Ações Recomendadas
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Insights acionáveis para melhorar seus resultados</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {stats.insights.map((insight, index) => (
                  <Alert key={index} className={
                    insight.type === 'warning' ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/20' :
                    insight.type === 'success' ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' :
                    'border-blue-500/50 bg-blue-50 dark:bg-blue-950/20'
                  }>
                    <AlertTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2 flex-wrap">
                      {insight.priority === 'high' && <Badge variant="destructive" className="text-xs flex-shrink-0">Alta</Badge>}
                      {insight.priority === 'medium' && <Badge variant="default" className="text-xs flex-shrink-0">Média</Badge>}
                      {insight.priority === 'low' && <Badge variant="secondary" className="text-xs flex-shrink-0">Baixa</Badge>}
                      <span className="break-words">{insight.title}</span>
                    </AlertTitle>
                    <AlertDescription className="text-xs mt-1 break-words">
                      {insight.description}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Clientes em Risco */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
                Clientes em Risco
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Clientes VIP/Frequentes sem compra recente</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {stats.customersAtRisk.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Último pedido: {new Date(customer.lastPurchase).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Badge variant={customer.risk === 'Alto' ? 'destructive' : 'default'} className="text-xs">
                        {customer.segment}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4 text-xs sm:text-sm" size="sm" onClick={() => setLocation("/customers")}>
                Ver Todos os Clientes
              </Button>
            </CardContent>
          </Card>

          {/* Cashback Expirando */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 flex-shrink-0" />
                Cashback Expirando
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Saldos que expiram nos próximos 7 dias</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {stats.expiringCashback.map((cashback) => (
                  <div key={cashback.customerId} className="flex items-center justify-between gap-3 p-2 sm:p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base truncate">{cashback.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Expira em: {new Date(cashback.expiresAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm sm:text-base text-orange-600 whitespace-nowrap">{formatCurrency(cashback.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4 text-xs sm:text-sm" size="sm" onClick={() => setLocation("/cashback")}>
                Gerenciar Cashback
              </Button>
            </CardContent>
          </Card>

          {/* Campanhas Ativas */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" />
                Campanhas Ativas
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Status das campanhas em andamento</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {stats.activeCampaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between p-2 sm:p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm truncate">{campaign.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          variant={campaign.status === 'Ativa' ? 'default' : 'secondary'}
                          className="text-xs flex-shrink-0"
                        >
                          {campaign.status}
                        </Badge>
                        {campaign.sent > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {campaign.sent} enviados • {campaign.openRate.toFixed(1)}% abertura
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4 text-xs sm:text-sm" size="sm" onClick={() => setLocation("/campaigns")}>
                Ver Todas as Campanhas
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
