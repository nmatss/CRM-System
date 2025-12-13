import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Users, 
  ShoppingBag, 
  Tags
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import type { Order } from "@shared/schema";

const stats = [
  {
    title: "Vendas Totais",
    value: "R$ 145.231,89",
    change: "+20.1% vs mês anterior",
    trend: "up",
    icon: DollarSign,
  },
  {
    title: "Ticket Médio",
    value: "R$ 450,00",
    change: "+12.5% vs mês anterior",
    trend: "up",
    icon: Tags,
  },
  {
    title: "Total de Pedidos",
    value: "324",
    change: "+19% vs mês anterior",
    trend: "up",
    icon: ShoppingBag,
  },
  {
    title: "Novos Clientes VIP",
    value: "+12",
    change: "+4 nesta semana",
    trend: "up",
    icon: Users,
  },
];

const chartData = [
  { name: "Seg", total: 4200 },
  { name: "Ter", total: 3100 },
  { name: "Qua", total: 5800 },
  { name: "Qui", total: 4400 },
  { name: "Sex", total: 8800 },
  { name: "Sab", total: 12500 },
  { name: "Dom", total: 9500 },
];

export default function Dashboard() {
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecentOrders() {
      try {
        const response = await fetch("/api/orders");
        if (response.ok) {
          const data = await response.json();
          setRecentOrders(data.slice(0, 5));
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchRecentOrders();
  }, []);

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Visão Geral da Loja</h1>
            <p className="text-sm text-muted-foreground">Performance da Coleção Primavera 2025</p>
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
          {stats.map((stat, index) => (
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
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : recentOrders.length === 0 ? (
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
                          {order.date}
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
