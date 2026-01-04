import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  User,
  Mail,
  Phone,
  Tag,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Wallet,
  MessageSquare,
  Clock,
  Calendar,
  Package,
  Star,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import type { Customer } from "@shared/schema";

interface CustomerDetailProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Dados mockados para o histórico de compras
const mockPurchases = [
  {
    id: 1,
    date: "2024-01-15",
    orderId: "#ORD-8901",
    value: 459.90,
    products: ["Vestido Longo", "Sandália"],
    cashbackEarned: 22.99,
    status: "Entregue"
  },
  {
    id: 2,
    date: "2024-01-08",
    orderId: "#ORD-8823",
    value: 329.50,
    products: ["Bolsa de Couro", "Cinto"],
    cashbackEarned: 16.48,
    status: "Entregue"
  },
  {
    id: 3,
    date: "2023-12-20",
    orderId: "#ORD-8654",
    value: 189.90,
    products: ["Blusa Estampada"],
    cashbackEarned: 9.50,
    status: "Entregue"
  },
  {
    id: 4,
    date: "2023-12-10",
    orderId: "#ORD-8501",
    value: 679.00,
    products: ["Casaco de Inverno", "Cachecol", "Luvas"],
    cashbackEarned: 33.95,
    status: "Entregue"
  },
  {
    id: 5,
    date: "2023-11-25",
    orderId: "#ORD-8234",
    value: 249.90,
    products: ["Tênis Casual"],
    cashbackEarned: 12.49,
    status: "Entregue"
  },
];

// Histórico de cashback
const mockCashbackHistory = [
  { id: 1, date: "2024-01-15", type: "Ganho", value: 22.99, source: "Compra #ORD-8901" },
  { id: 2, date: "2024-01-12", type: "Resgatado", value: -50.00, source: "Compra #ORD-8890" },
  { id: 3, date: "2024-01-08", type: "Ganho", value: 16.48, source: "Compra #ORD-8823" },
  { id: 4, date: "2023-12-20", type: "Ganho", value: 9.50, source: "Compra #ORD-8654" },
  { id: 5, date: "2023-12-10", type: "Ganho", value: 33.95, source: "Compra #ORD-8501" },
  { id: 6, date: "2023-12-05", type: "Resgatado", value: -30.00, source: "Compra #ORD-8421" },
];

// Evolução do saldo de cashback
const cashbackEvolution = [
  { month: "Jul", balance: 15.50 },
  { month: "Ago", balance: 28.30 },
  { month: "Set", balance: 42.80 },
  { month: "Out", balance: 35.20 },
  { month: "Nov", balance: 58.65 },
  { month: "Dez", balance: 72.10 },
  { month: "Jan", balance: 61.57 },
];

// Campanhas recebidas
const mockCampaigns = [
  {
    id: 1,
    date: "2024-01-10",
    channel: "WhatsApp",
    name: "Promoção de Verão",
    status: "Clicou",
    engagement: 100
  },
  {
    id: 2,
    date: "2024-01-05",
    channel: "E-mail",
    name: "Cashback em Dobro",
    status: "Aberto",
    engagement: 50
  },
  {
    id: 3,
    date: "2023-12-28",
    channel: "SMS",
    name: "Lembrete de Cashback",
    status: "Entregue",
    engagement: 0
  },
  {
    id: 4,
    date: "2023-12-15",
    channel: "E-mail",
    name: "Black Friday Final",
    status: "Clicou",
    engagement: 100
  },
];

// Produtos favoritos
const favoriteProducts = [
  { category: "Vestidos", purchases: 8, percentage: 32 },
  { category: "Calçados", purchases: 5, percentage: 20 },
  { category: "Bolsas", purchases: 4, percentage: 16 },
  { category: "Acessórios", purchases: 4, percentage: 16 },
  { category: "Outros", purchases: 4, percentage: 16 },
];

// Horários preferidos
const preferredTimes = [
  { period: "Manhã (8h-12h)", percentage: 15 },
  { period: "Tarde (12h-18h)", percentage: 45 },
  { period: "Noite (18h-22h)", percentage: 35 },
  { period: "Madrugada (22h-8h)", percentage: 5 },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

export function CustomerDetail({ customer, open, onOpenChange }: CustomerDetailProps) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!customer) return null;

  const totalSpent = mockPurchases.reduce((sum, p) => sum + p.value, 0);
  const totalCashbackEarned = mockPurchases.reduce((sum, p) => sum + p.cashbackEarned, 0);
  const currentBalance = 61.57;
  const churnScore = 23; // 0-100, menor é melhor
  const estimatedLTV = 2450.00;
  const engagementRate = 75;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={customer.image || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xl">
                {customer.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="text-2xl">{customer.name}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <Mail className="h-3 w-3" />
                {customer.email}
              </SheetDescription>
            </div>
            <Badge
              variant={
                customer.segment === "VIP" ? "default" :
                customer.segment === "Em Risco" ? "destructive" :
                customer.segment === "Novo" ? "secondary" : "outline"
              }
              className={customer.segment === "VIP" ? "bg-purple-600" : ""}
            >
              {customer.segment}
            </Badge>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="text-xs">Resumo</TabsTrigger>
            <TabsTrigger value="purchases" className="text-xs">Compras</TabsTrigger>
            <TabsTrigger value="cashback" className="text-xs">Cashback</TabsTrigger>
            <TabsTrigger value="campaigns" className="text-xs">Campanhas</TabsTrigger>
            <TabsTrigger value="analysis" className="text-xs">Análise</TabsTrigger>
          </TabsList>

          {/* ABA 1: RESUMO */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados Básicos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Nome:</span>
                  <span>{customer.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">E-mail:</span>
                  <span>{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Telefone:</span>
                    <span>{customer.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Segmento:</span>
                  <Badge variant="outline">{customer.segment}</Badge>
                </div>
                {customer.favoriteCategory && (
                  <div className="flex items-center gap-2 text-sm">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Categoria Favorita:</span>
                    <span>{customer.favoriteCategory}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Score de Risco / Churn
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {churnScore < 30 ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : churnScore < 60 ? (
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                    <span className="text-2xl font-bold">{churnScore}%</span>
                  </div>
                  <Badge
                    variant={churnScore < 30 ? "default" : churnScore < 60 ? "secondary" : "destructive"}
                    className={churnScore < 30 ? "bg-green-600" : ""}
                  >
                    {churnScore < 30 ? "Baixo Risco" : churnScore < 60 ? "Risco Médio" : "Alto Risco"}
                  </Badge>
                </div>
                <Progress value={churnScore} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {churnScore < 30
                    ? "Cliente engajado com alta probabilidade de continuar comprando."
                    : churnScore < 60
                    ? "Cliente moderadamente ativo. Recomenda-se ações de retenção."
                    : "Cliente em risco de churn. Intervenção urgente necessária."}
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">LTV Estimado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(estimatedLTV)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Valor vitalício projetado
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Taxa de Engajamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{engagementRate}%</div>
                  <Progress value={engagementRate} className="h-1.5 mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Interage com campanhas
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags / Labels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Cliente Fiel</Badge>
                  <Badge variant="outline">Alto Valor</Badge>
                  <Badge variant="outline">Moda Feminina</Badge>
                  <Badge variant="outline">Compra Online</Badge>
                  <Badge variant="outline">WhatsApp Ativo</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 2: HISTÓRICO DE COMPRAS */}
          <TabsContent value="purchases" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Total Gasto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lifetime spending
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Frequência</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">5 compras</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ticket médio: {formatCurrency(totalSpent / 5)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Pedidos</CardTitle>
                <CardDescription>Todas as compras realizadas</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Produtos</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Cashback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockPurchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="text-sm">{formatDate(purchase.date)}</TableCell>
                        <TableCell className="font-mono text-xs">{purchase.orderId}</TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate">
                          {purchase.products.join(", ")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(purchase.value)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 font-medium text-sm">
                          +{formatCurrency(purchase.cashbackEarned)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 3: CASHBACK */}
          <TabsContent value="cashback" className="space-y-6 mt-6">
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-900/50">
              <CardHeader>
                <CardTitle className="text-base">Saldo Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-4xl font-bold text-emerald-600">
                      {formatCurrency(currentBalance)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Disponível para uso
                    </p>
                  </div>
                  <Wallet className="h-12 w-12 text-emerald-600/30" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolução do Saldo</CardTitle>
                <CardDescription>Últimos 7 meses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cashbackEvolution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="balance"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ fill: "#10b981", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Transações</CardTitle>
                <CardDescription>Ganhos e resgates de cashback</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockCashbackHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{formatDate(item.date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={item.type === "Ganho" ? "default" : "secondary"}
                            className={item.type === "Ganho" ? "bg-emerald-600" : ""}
                          >
                            {item.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{item.source}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            item.value > 0 ? "text-emerald-600" : "text-muted-foreground"
                          }`}
                        >
                          {item.value > 0 ? "+" : ""}
                          {formatCurrency(item.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Total Ganho</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-emerald-600">
                    {formatCurrency(totalCashbackEarned)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground">Total Resgatado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {formatCurrency(80.00)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ABA 4: CAMPANHAS */}
          <TabsContent value="campaigns" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Taxa de Engajamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Entregue</span>
                    <span className="font-medium">100%</span>
                  </div>
                  <Progress value={100} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Aberto</span>
                    <span className="font-medium">75%</span>
                  </div>
                  <Progress value={75} className="h-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Clicou</span>
                    <span className="font-medium">50%</span>
                  </div>
                  <Progress value={50} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campanhas Recebidas</CardTitle>
                <CardDescription>Histórico de comunicação</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockCampaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="text-sm">{formatDate(campaign.date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {campaign.channel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{campaign.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              campaign.status === "Clicou" ? "default" :
                              campaign.status === "Aberto" ? "secondary" :
                              "outline"
                            }
                            className={campaign.status === "Clicou" ? "bg-green-600" : ""}
                          >
                            {campaign.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Canais Preferidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-green-600" />
                    <span className="text-sm">WhatsApp</span>
                  </div>
                  <span className="font-medium">85%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">E-mail</span>
                  </div>
                  <span className="font-medium">65%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-orange-600" />
                    <span className="text-sm">SMS</span>
                  </div>
                  <span className="font-medium">40%</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 5: ANÁLISE */}
          <TabsContent value="analysis" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Produtos Favoritos</CardTitle>
                <CardDescription>Categorias mais compradas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={favoriteProducts}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="category" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                      />
                      <Bar dataKey="purchases" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 space-y-2">
                  {favoriteProducts.map((product) => (
                    <div key={product.category} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{product.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{product.purchases} compras</span>
                        <span className="text-muted-foreground">({product.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Horários de Compra Preferidos</CardTitle>
                <CardDescription>Quando o cliente costuma comprar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {preferredTimes.map((time) => (
                  <div key={time.period}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{time.period}</span>
                      <span className="font-medium">{time.percentage}%</span>
                    </div>
                    <Progress value={time.percentage} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Previsão de Próxima Compra</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      <span className="font-medium">8-12 dias</span>
                    </div>
                    <Progress value={70} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      70% de probabilidade baseado no histórico de compras
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border-indigo-200 dark:border-indigo-900/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  Recomendações de IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-background border">
                  <div className="flex items-start gap-3">
                    <ArrowRight className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Oferta Personalizada</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Cliente tem alta afinidade com vestidos. Recomende nova coleção de verão.
                      </p>
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        Criar campanha
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-background border">
                  <div className="flex items-start gap-3">
                    <ArrowRight className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Lembrete de Cashback</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Cliente tem R$ 61,57 em cashback. Envie lembrete com sugestão de produto.
                      </p>
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        Enviar lembrete
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-background border">
                  <div className="flex items-start gap-3">
                    <ArrowRight className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Upsell Opportunity</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Ticket médio está 30% abaixo do potencial. Sugira produtos complementares.
                      </p>
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        Ver sugestões
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
