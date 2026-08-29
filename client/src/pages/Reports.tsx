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
  Legend,
} from "recharts";
import {
  Calendar,
  Download,
  FileSpreadsheet,
  Loader2,
  Users,
  TrendingUp,
  DollarSign,
  ShoppingBag,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toReportDate } from "@/lib/reportPresentation";
import { serializeCsv } from "@/lib/csvExport";

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

const COLORS = ["hsl(var(--primary))", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];
const SEGMENT_COLORS: Record<string, string> = {
  VIP: "hsl(var(--primary))",
  Frequente: "#00C49F",
  Novo: "#FFBB28",
  "Em Risco": "#FF8042",
  Inativo: "#8884d8",
};

export default function Reports() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const { data: reports, isLoading } = useQuery<ReportsData>({
    queryKey: [
      "reports",
      dateRange.from ? toReportDate(dateRange.from) : null,
      dateRange.to ? toReportDate(dateRange.to) : null,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      // The API takes a calendar-day range; a full ISO instant is refused.
      if (dateRange.from) params.append("startDate", toReportDate(dateRange.from));
      if (dateRange.to) params.append("endDate", toReportDate(dateRange.to));

      const response = await fetch(`/api/v1/reports?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao carregar relatórios");
      return response.json();
    },
  });

  const exportToCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = serializeCsv(
      data,
      headers.map((key) => ({ key, label: key })),
    );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSalesReport = () => {
    if (!reports?.orders) return;
    exportToCSV(reports.orders, "vendas", ["id", "customer", "product", "date", "total", "status"]);
  };

  const exportCustomersReport = () => {
    if (!reports?.topCustomers) return;
    exportToCSV(reports.topCustomers, "clientes", [
      "id",
      "name",
      "email",
      "segment",
      "ltv",
      "orderCount",
    ]);
  };

  const quickDateRanges = [
    { label: "Últimos 7 dias", from: subDays(new Date(), 7), to: new Date() },
    { label: "Últimos 30 dias", from: subDays(new Date(), 30), to: new Date() },
    { label: "Este mês", from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    {
      label: "Mês passado",
      from: startOfMonth(subDays(startOfMonth(new Date()), 1)),
      to: endOfMonth(subDays(startOfMonth(new Date()), 1)),
    },
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
            <h1
              className="text-xl sm:text-2xl font-bold tracking-tight"
              data-testid="text-page-title"
            >
              Relatórios
            </h1>
            <p className="text-sm text-muted-foreground">
              Análise detalhada de performance do seu negócio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 text-xs sm:text-sm"
                  data-testid="button-date-range"
                >
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {dateRange.from && dateRange.to
                      ? `${format(dateRange.from, "dd/MM", { locale: ptBR })} - ${format(dateRange.to, "dd/MM", { locale: ptBR })}`
                      : "Selecionar período"}
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
                  numberOfMonths={typeof window !== "undefined" && window.innerWidth < 640 ? 1 : 2}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              className="gap-2 text-xs sm:text-sm"
              onClick={exportSalesReport}
              data-testid="button-export-csv"
            >
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
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="sales" data-testid="tab-sales" className="text-xs sm:text-sm">
              Vendas
            </TabsTrigger>
            <TabsTrigger
              value="customers"
              data-testid="tab-customers"
              className="text-xs sm:text-sm"
            >
              Clientes
            </TabsTrigger>
            <TabsTrigger
              value="campaigns"
              data-testid="tab-campaigns"
              className="text-xs sm:text-sm"
            >
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="cashback" data-testid="tab-cashback" className="text-xs sm:text-sm">
              Cashback
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Vendas por Mês</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Evolução de vendas no período selecionado.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full min-h-[250px] sm:min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reports?.salesByMonth || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `R$${v}`}
                          fontSize={11}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                          formatter={(value: number) => [
                            `R$ ${value.toLocaleString("pt-BR")}`,
                            "Vendas",
                          ]}
                        />
                        <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Vendas por Categoria</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Distribuição de receita por tipo de produto.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full min-h-[250px] sm:min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reports?.salesByCategory || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="value"
                          label={false}
                        >
                          {(reports?.salesByCategory || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [
                            `R$ ${value.toLocaleString("pt-BR")}`,
                            "Valor",
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg">Últimos Pedidos</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Lista de vendas no período selecionado.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportSalesReport}
                  data-testid="button-export-orders"
                  className="w-fit text-xs sm:text-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm">
                        Produto
                      </TableHead>
                      <TableHead className="text-xs sm:text-sm">Data</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Total</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reports?.orders || []).slice(0, 10).map((order) => (
                      <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                        <TableCell className="font-medium text-xs sm:text-sm">
                          {order.customer}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs sm:text-sm">
                          {order.product}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">{order.date}</TableCell>
                        <TableCell className="text-right text-xs sm:text-sm">
                          {order.total}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge
                            variant={order.status === "Entregue" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!reports?.orders || reports.orders.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground py-8 text-xs sm:text-sm"
                        >
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
                  <CardTitle className="text-base sm:text-lg">Clientes por Segmento</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Distribuição da base de clientes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full min-h-[250px] sm:min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reports?.customersBySegment || []}
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="count"
                          label={false}
                        >
                          {(reports?.customersBySegment || []).map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={SEGMENT_COLORS[entry.name] || COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Segmentos</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Quantidade de clientes por segmento.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full min-h-[250px] sm:min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reports?.customersBySegment || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" axisLine={false} tickLine={false} fontSize={11} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          axisLine={false}
                          tickLine={false}
                          width={70}
                          fontSize={10}
                        />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg">Top Clientes por LTV</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Clientes com maior valor ao longo do tempo.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCustomersReport}
                  data-testid="button-export-customers"
                  className="w-fit text-xs sm:text-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Cliente</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm">
                        Email
                      </TableHead>
                      <TableHead className="text-xs sm:text-sm">Segmento</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">LTV</TableHead>
                      <TableHead className="text-right hidden sm:table-cell text-xs sm:text-sm">
                        Pedidos
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reports?.topCustomers || []).map((customer) => (
                      <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                        <TableCell className="font-medium text-xs sm:text-sm">
                          {customer.name}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs sm:text-sm">
                          {customer.email}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: SEGMENT_COLORS[customer.segment] || COLORS[0] }}
                          >
                            {customer.segment}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm">
                          {customer.ltv}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell text-xs sm:text-sm">
                          {customer.orderCount}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!reports?.topCustomers || reports.topCustomers.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground py-8 text-xs sm:text-sm"
                        >
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
                <CardTitle className="text-base sm:text-lg">Performance das Campanhas</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Métricas de suas campanhas de marketing.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Campanha</TableHead>
                      <TableHead className="text-xs sm:text-sm">Canal</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm">
                        Enviados
                      </TableHead>
                      <TableHead className="hidden md:table-cell text-xs sm:text-sm">
                        Taxa Abertura
                      </TableHead>
                      <TableHead className="hidden md:table-cell text-xs sm:text-sm">
                        Conversão
                      </TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Receita</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reports?.campaignStats || []).map((campaign) => (
                      <TableRow key={campaign.id} data-testid={`row-campaign-${campaign.id}`}>
                        <TableCell className="font-medium text-xs sm:text-sm">
                          {campaign.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {campaign.channel}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs sm:text-sm">
                          {campaign.sent}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                          {campaign.openRate}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                          {campaign.conversion}
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm">
                          {campaign.revenue}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className="text-xs"
                            variant={
                              campaign.status === "Ativa"
                                ? "default"
                                : campaign.status === "Concluída"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {campaign.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!reports?.campaignStats || reports.campaignStats.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground py-8 text-xs sm:text-sm"
                        >
                          Nenhuma campanha encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cashback" className="space-y-4">
            {/* KPIs de Cashback */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
              <Card data-testid="card-cashback-granted">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Concedido</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className="text-lg sm:text-2xl font-bold"
                    data-testid="text-cashback-granted"
                  >
                    R$ 184.200
                  </div>
                  <p className="text-xs text-muted-foreground">No período selecionado</p>
                </CardContent>
              </Card>

              <Card data-testid="card-cashback-redeemed">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Resgatado</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className="text-lg sm:text-2xl font-bold"
                    data-testid="text-cashback-redeemed"
                  >
                    R$ 45.680
                  </div>
                  <p className="text-xs text-emerald-700">24.8% de resgate</p>
                </CardContent>
              </Card>

              <Card data-testid="card-cashback-pending">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Passivo Total</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className="text-lg sm:text-2xl font-bold"
                    data-testid="text-cashback-pending"
                  >
                    R$ 142.300
                  </div>
                  <p className="text-xs text-orange-600">Saldo não resgatado</p>
                </CardContent>
              </Card>

              <Card data-testid="card-redemption-rate">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Resgate</CardTitle>
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold" data-testid="text-redemption-rate">
                    24.8%
                  </div>
                  <p className="text-xs text-emerald-700">+2.1% vs mês anterior</p>
                </CardContent>
              </Card>

              <Card data-testid="card-cashback-roi">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ROI do Cashback</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-2xl font-bold" data-testid="text-cashback-roi">
                    12.0x
                  </div>
                  <p className="text-xs text-emerald-700">Retorno sobre investimento</p>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos de Cashback */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">
                    Cashback Concedido vs Resgatado
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Evolução mensal dos últimos 6 meses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full min-h-[250px] sm:min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { month: "Jul", concedido: 28000, resgatado: 7200 },
                          { month: "Ago", concedido: 32000, resgatado: 8100 },
                          { month: "Set", concedido: 29500, resgatado: 7850 },
                          { month: "Out", concedido: 35000, resgatado: 8900 },
                          { month: "Nov", concedido: 31200, resgatado: 7450 },
                          { month: "Dez", concedido: 28500, resgatado: 7180 },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={11} />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `R$${v}`}
                          fontSize={11}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                          formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, ""]}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        <Bar
                          dataKey="concedido"
                          fill="#9333ea"
                          radius={[4, 4, 0, 0]}
                          name="Concedido"
                        />
                        <Bar
                          dataKey="resgatado"
                          fill="#00C49F"
                          radius={[4, 4, 0, 0]}
                          name="Resgatado"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Distribuição de Saldos</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Clientes por faixa de saldo de cashback
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full min-h-[250px] sm:min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "< R$ 10", value: 387, color: "#8884d8" },
                            { name: "R$ 10-50", value: 512, color: "#00C49F" },
                            { name: "R$ 50-100", value: 245, color: "#FFBB28" },
                            { name: "> R$ 100", value: 148, color: "#9333ea" },
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          dataKey="value"
                          label={false}
                        >
                          {[
                            { name: "< R$ 10", value: 387, color: "#8884d8" },
                            { name: "R$ 10-50", value: 512, color: "#00C49F" },
                            { name: "R$ 50-100", value: 245, color: "#FFBB28" },
                            { name: "> R$ 100", value: 148, color: "#9333ea" },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance por Regra de Cashback */}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg">
                    Performance por Regra de Cashback
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Análise detalhada do desempenho de cada regra
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-export-cashback"
                  className="w-fit text-xs sm:text-sm"
                  disabled
                  title="A API ainda não fornece exportação de cashback por regra"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportação indisponível
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Regra</TableHead>
                      <TableHead className="text-center text-xs sm:text-sm">Clientes</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Concedido</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Resgatado</TableHead>
                      <TableHead className="text-right hidden md:table-cell text-xs sm:text-sm">
                        Taxa Resgate
                      </TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">ROI</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow data-testid="row-rule-1">
                      <TableCell className="font-medium text-xs sm:text-sm">
                        Cashback Primeira Compra
                      </TableCell>
                      <TableCell className="text-center text-xs sm:text-sm">387</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">R$ 38.700</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">R$ 12.450</TableCell>
                      <TableCell className="text-right hidden md:table-cell text-xs sm:text-sm">
                        32.2%
                      </TableCell>
                      <TableCell className="text-right text-emerald-700 font-semibold text-xs sm:text-sm">
                        15.2x
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="default" className="text-xs">
                          Ativa
                        </Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-rule-2">
                      <TableCell className="font-medium text-xs sm:text-sm">
                        Cashback Compra Acima R$ 200
                      </TableCell>
                      <TableCell className="text-center text-xs sm:text-sm">512</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">R$ 76.800</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">R$ 18.240</TableCell>
                      <TableCell className="text-right hidden md:table-cell text-xs sm:text-sm">
                        23.8%
                      </TableCell>
                      <TableCell className="text-right text-emerald-700 font-semibold text-xs sm:text-sm">
                        11.4x
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="default" className="text-xs">
                          Ativa
                        </Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-rule-3">
                      <TableCell className="font-medium text-xs sm:text-sm">
                        Cashback Aniversário
                      </TableCell>
                      <TableCell className="text-center text-xs sm:text-sm">245</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">R$ 36.750</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">R$ 8.820</TableCell>
                      <TableCell className="text-right hidden md:table-cell text-xs sm:text-sm">
                        24.0%
                      </TableCell>
                      <TableCell className="text-right text-emerald-700 font-semibold text-xs sm:text-sm">
                        9.8x
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="default" className="text-xs">
                          Ativa
                        </Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-rule-4">
                      <TableCell className="font-medium text-xs sm:text-sm">
                        Cashback VIP (3%)
                      </TableCell>
                      <TableCell className="text-center text-xs sm:text-sm">148</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">R$ 22.200</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">R$ 4.440</TableCell>
                      <TableCell className="text-right hidden md:table-cell text-xs sm:text-sm">
                        20.0%
                      </TableCell>
                      <TableCell className="text-right text-emerald-700 font-semibold text-xs sm:text-sm">
                        13.5x
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="default" className="text-xs">
                          Ativa
                        </Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow data-testid="row-rule-5">
                      <TableCell className="font-medium text-xs sm:text-sm">
                        Cashback Indicação
                      </TableCell>
                      <TableCell className="text-center text-xs sm:text-sm">89</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">R$ 9.750</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">R$ 1.730</TableCell>
                      <TableCell className="text-right hidden md:table-cell text-xs sm:text-sm">
                        17.7%
                      </TableCell>
                      <TableCell className="text-right text-orange-600 font-semibold text-xs sm:text-sm">
                        7.2x
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary" className="text-xs">
                          Pausada
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Análise Adicional */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Taxa de Resgate por Mês</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Evolução da taxa de resgate ao longo do tempo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="w-full min-h-[200px] sm:min-h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={[
                          { month: "Jul", taxa: 22.5 },
                          { month: "Ago", taxa: 23.1 },
                          { month: "Set", taxa: 24.2 },
                          { month: "Out", taxa: 23.8 },
                          { month: "Nov", taxa: 24.5 },
                          { month: "Dez", taxa: 24.8 },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={11} />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${v}%`}
                          fontSize={11}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                          formatter={(value: number) => [`${value}%`, "Taxa de Resgate"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="taxa"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))", r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Resumo Executivo</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Principais métricas e insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <div>
                        <p className="font-medium text-xs sm:text-sm">Retenção com Cashback</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                          Clientes que usaram cashback
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-700 text-base sm:text-lg">42%</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">de recompra</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 sm:p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div>
                        <p className="font-medium text-xs sm:text-sm">Cashback Expirando</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                          Próximos 7 dias
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-orange-600 text-base sm:text-lg">R$ 8.450</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">47 clientes</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 sm:p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div>
                        <p className="font-medium text-xs sm:text-sm">Ticket Médio com Cashback</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                          Vs sem cashback
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600 text-base sm:text-lg">+28%</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          R$ 185 vs R$ 145
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
