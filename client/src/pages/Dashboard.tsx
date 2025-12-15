import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Users, 
  ShoppingBag, 
  Tags,
  Loader2
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import type { Order } from "@shared/schema";

const formatDate = (date: Date | string | null): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
};

interface DashboardStats {
  totalRevenue: string;
  averageTicket: string;
  totalOrders: number;
  vipCustomers: number;
  newCustomers: number;
  totalCustomers: number;
  totalProducts: number;
  weeklyData: Array<{ name: string; total: number }>;
  recentOrders: Order[];
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/stats");
      if (!response.ok) throw new Error("Erro ao carregar estatísticas");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const statsCards = [
    {
      title: "Vendas Totais",
      value: stats?.totalRevenue || "R$ 0,00",
      change: `${stats?.totalOrders || 0} pedidos`,
      trend: "up",
      icon: DollarSign,
    },
    {
      title: "Ticket Médio",
      value: stats?.averageTicket || "R$ 0,00",
      change: "Valor médio por pedido",
      trend: "up",
      icon: Tags,
    },
    {
      title: "Total de Pedidos",
      value: stats?.totalOrders?.toString() || "0",
      change: `${stats?.totalCustomers || 0} clientes`,
      trend: "up",
      icon: ShoppingBag,
    },
    {
      title: "Clientes VIP",
      value: `+${stats?.vipCustomers || 0}`,
      change: `${stats?.newCustomers || 0} novos clientes`,
      trend: "up",
      icon: Users,
    },
  ];

  const chartData = stats?.weeklyData || [
    { name: "Dom", total: 0 },
    { name: "Seg", total: 0 },
    { name: "Ter", total: 0 },
    { name: "Qua", total: 0 },
    { name: "Qui", total: 0 },
    { name: "Sex", total: 0 },
    { name: "Sáb", total: 0 },
  ];

  const recentOrders = stats?.recentOrders || [];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Visão Geral da Loja</h1>
            <p className="text-sm text-muted-foreground">Performance da sua loja em tempo real</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm flex-1 sm:flex-none" data-testid="button-download-report">
              <span className="hidden sm:inline">Baixar Relatório</span>
              <span className="sm:hidden">Relatório</span>
            </Button>
            <Button size="sm" className="text-xs sm:text-sm flex-1 sm:flex-none" data-testid="button-dashboard-new-order">
              <span className="hidden sm:inline">Novo Pedido</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {statsCards.map((stat, index) => (
            <Card key={index} data-testid={`card-stat-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold" data-testid={`text-stat-value-${index}`}>{stat.value}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  {stat.trend === "up" ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-rose-500" />
                  )}
                  <span className={stat.trend === "up" ? "text-emerald-500" : "text-rose-500"}>
                    {stat.change}
                  </span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Receita Semanal</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[250px] sm:h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis 
                      dataKey="name" 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `R$${value}`}
                    />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))", 
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }} 
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Total']}
                    />
                    <Bar
                      dataKey="total" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Vendas Recentes</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Feed ao vivo de vendas online e loja física.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">Nenhuma venda recente.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {recentOrders.map((order, index) => (
                    <div key={order.id} className="flex items-center" data-testid={`row-recent-sale-${index}`}>
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{order.customer.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none" data-testid={`text-customer-name-${index}`}>{order.customer}</p>
                        <p className="text-sm text-muted-foreground truncate w-[140px]" data-testid={`text-order-date-${index}`}>
                          {formatDate(order.orderDate)}
                        </p>
                      </div>
                      <div className="ml-auto font-medium" data-testid={`text-order-total-${index}`}>{order.total}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
