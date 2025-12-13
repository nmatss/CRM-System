import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { Calendar, Download, FileSpreadsheet, Loader2, Users, TrendingUp, DollarSign, ShoppingBag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ReportsData {
  summary: {
    totalRevenue: string;
    totalOrders: number;
    averageTicket: string;
    totalCustomers: number;
    totalProducts: number;
  };
  salesByMonth: Array<{ name: string; sales: number; orders: number }>;
  salesByCategory: Array<{ name: string; value: number }>;
  customersBySegment: Array<{ name: string; count: number }>;
  topCustomers: Array<{
    id: number;
    name: string;
    email: string;
    segment: string;
    ltv: string;
    orderCount: number;
  }>;
  campaignStats: Array<{
    id: number;
    name: string;
    channel: string;
    status: string;
    sent: number;
    openRate: string;
    conversion: string;
    revenue: string;
  }>;
  orders: Array<{
    id: number;
    customer: string;
    product: string;
    date: string;
    total: string;
    status: string;
  }>;
}

const COLORS = ['hsl(var(--primary))', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const SEGMENT_COLORS: Record<string, string> = {
  'VIP': 'hsl(var(--primary))',
  'Frequente': '#00C49F',
  'Novo': '#FFBB28',
  'Em Risco': '#FF8042',
  'Inativo': '#8884d8',
};

export default function Reports() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const { data: reports, isLoading } = useQuery<ReportsData>({
    queryKey: ["reports", dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.from) params.append("startDate", dateRange.from.toISOString());
      if (dateRange.to) params.append("endDate", dateRange.to.toISOString());
      
      const response = await fetch(`/api/reports?${params.toString()}`);
      if (!response.ok) throw new Error("Erro ao carregar relatórios");
      return response.json();
    },
  });

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const key = h.toLowerCase().replace(/\s+/g, '');
        const value = row[key] ?? row[h] ?? '';
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportSalesReport = () => {
    if (!reports?.orders) return;
    exportToCSV(
      reports.orders,
      'vendas',
      ['id', 'customer', 'product', 'date', 'total', 'status']
    );
  };

  const exportCustomersReport = () => {
    if (!reports?.topCustomers) return;
    exportToCSV(
      reports.topCustomers,
      'clientes',
      ['id', 'name', 'email', 'segment', 'ltv', 'orderCount']
    );
  };

  const quickDateRanges = [
    { label: "Últimos 7 dias", from: subDays(new Date(), 7), to: new Date() },
    { label: "Últimos 30 dias", from: subDays(new Date(), 30), to: new Date() },
    { label: "Este mês", from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    { label: "Mês passado", from: startOfMonth(subDays(startOfMonth(new Date()), 1)), to: endOfMonth(subDays(startOfMonth(new Date()), 1)) },
  ];

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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-page-title">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Análise detalhada de performance do seu negócio.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 text-xs sm:text-sm" data-testid="button-date-range">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {dateRange.from && dateRange.to
                      ? `${format(dateRange.from, "dd/MM", { locale: ptBR })} - ${format(dateRange.to, "dd/MM", { locale: ptBR })}`
                      : "Selecionar período"
                    }
                  </span>
                  <span className="sm:hidden">Período</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-3 border-b">
                  <div className="flex flex-wrap gap-2">
                    {quickDateRanges.map((range, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setDateRange({ from: range.from, to: range.to })}
                        data-testid={`button-quick-range-${i}`}
                      >
                        {range.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <CalendarComponent
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  locale={ptBR}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" className="gap-2 text-xs sm:text-sm" onClick={exportSalesReport} data-testid="button-export-csv">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-revenue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold" data-testid="text-total-revenue">
                {reports?.summary.totalRevenue || "R$ 0,00"}
              </div>
              <p className="text-xs text-muted-foreground">No período selecionado</p>
            </CardContent>
          </Card>
          <Card data-testid="card-total-orders">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold" data-testid="text-total-orders">
                {reports?.summary.totalOrders || 0}
              </div>
              <p className="text-xs text-muted-foreground">No período selecionado</p>
            </CardContent>
          </Card>
          <Card data-testid="card-average-ticket">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold" data-testid="text-average-ticket">
                {reports?.summary.averageTicket || "R$ 0,00"}
              </div>
              <p className="text-xs text-muted-foreground">Valor médio por pedido</p>
            </CardContent>
          </Card>
          <Card data-testid="card-total-customers">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold" data-testid="text-total-customers">
                {reports?.summary.totalCustomers || 0}
              </div>
              <p className="text-xs text-muted-foreground">Base de clientes</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sales" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sales" data-testid="tab-sales">Vendas</TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">Clientes</TabsTrigger>
            <TabsTrigger value="campaigns" data-testid="tab-campaigns">Campanhas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sales" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Vendas por Mês</CardTitle>
                  <CardDescription>Evolução de vendas no período selecionado.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reports?.salesByMonth || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--popover))", 
                            borderColor: "hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                          formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Vendas']}
                        />
                        <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Vendas por Categoria</CardTitle>
                  <CardDescription>Distribuição de receita por tipo de produto.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reports?.salesByCategory || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {(reports?.salesByCategory || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Valor']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Últimos Pedidos</CardTitle>
                  <CardDescription>Lista de vendas no período selecionado.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportSalesReport} data-testid="button-export-orders">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell">Produto</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reports?.orders || []).slice(0, 10).map((order) => (
                      <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                        <TableCell className="font-medium">{order.customer}</TableCell>
                        <TableCell className="hidden sm:table-cell">{order.product}</TableCell>
                        <TableCell>{order.date}</TableCell>
                        <TableCell className="text-right">{order.total}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={order.status === "Entregue" ? "default" : "secondary"}>
                            {order.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!reports?.orders || reports.orders.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum pedido encontrado no período.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="customers" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Clientes por Segmento</CardTitle>
                  <CardDescription>Distribuição da base de clientes.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reports?.customersBySegment || []}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                          label={({ name, count }) => `${name}: ${count}`}
                        >
                          {(reports?.customersBySegment || []).map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={SEGMENT_COLORS[entry.name] || COLORS[index % COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Segmentos</CardTitle>
                  <CardDescription>Quantidade de clientes por segmento.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reports?.customersBySegment || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Top Clientes por LTV</CardTitle>
                  <CardDescription>Clientes com maior valor ao longo do tempo.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportCustomersReport} data-testid="button-export-customers">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead className="text-right">LTV</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Pedidos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reports?.topCustomers || []).map((customer) => (
                      <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell className="hidden sm:table-cell">{customer.email}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            style={{ borderColor: SEGMENT_COLORS[customer.segment] || COLORS[0] }}
                          >
                            {customer.segment}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{customer.ltv}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">{customer.orderCount}</TableCell>
                      </TableRow>
                    ))}
                    {(!reports?.topCustomers || reports.topCustomers.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum cliente encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="campaigns" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance das Campanhas</CardTitle>
                <CardDescription>Métricas de suas campanhas de marketing.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead className="hidden sm:table-cell">Enviados</TableHead>
                      <TableHead className="hidden md:table-cell">Taxa Abertura</TableHead>
                      <TableHead className="hidden md:table-cell">Conversão</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reports?.campaignStats || []).map((campaign) => (
                      <TableRow key={campaign.id} data-testid={`row-campaign-${campaign.id}`}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{campaign.channel}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{campaign.sent}</TableCell>
                        <TableCell className="hidden md:table-cell">{campaign.openRate}</TableCell>
                        <TableCell className="hidden md:table-cell">{campaign.conversion}</TableCell>
                        <TableCell className="text-right">{campaign.revenue}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              campaign.status === "Ativa" ? "default" : 
                              campaign.status === "Concluída" ? "secondary" : "outline"
                            }
                          >
                            {campaign.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!reports?.campaignStats || reports.campaignStats.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhuma campanha encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
