import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip
} from "recharts";
import {
  AlertCircle,
  Send,
  TrendingUp,
  Sparkles
} from "lucide-react";

// Dados mockados para distribuição de saldos
const balanceDistribution = [
  { range: "<R$10", value: 234, percentage: 35, color: "#ef4444" },
  { range: "R$10-50", value: 189, percentage: 28, color: "#f59e0b" },
  { range: "R$50-100", value: 145, percentage: 22, color: "#10b981" },
  { range: ">R$100", value: 98, percentage: 15, color: "#8b5cf6" },
];

// Clientes com cashback expirando
const expiringClients = [
  {
    id: 1,
    name: "Maria Silva",
    email: "maria.silva@email.com",
    balance: 45.80,
    expiresIn: 3,
    avatar: null
  },
  {
    id: 2,
    name: "João Santos",
    email: "joao.santos@email.com",
    balance: 78.50,
    expiresIn: 5,
    avatar: null
  },
  {
    id: 3,
    name: "Ana Costa",
    email: "ana.costa@email.com",
    balance: 32.20,
    expiresIn: 4,
    avatar: null
  },
  {
    id: 4,
    name: "Pedro Oliveira",
    email: "pedro.oliveira@email.com",
    balance: 91.00,
    expiresIn: 7,
    avatar: null
  },
  {
    id: 5,
    name: "Carla Souza",
    email: "carla.souza@email.com",
    balance: 56.40,
    expiresIn: 6,
    avatar: null
  },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function BalanceDistributionWidget() {
  const totalClients = balanceDistribution.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold">{payload[0].payload.range}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} clientes ({payload[0].payload.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
      {balanceDistribution.map((item) => (
        <div key={item.range} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">{item.range}</p>
            <p className="text-xs text-muted-foreground">
              {item.value} ({item.percentage}%)
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Distribuição de Saldos
        </CardTitle>
        <CardDescription className="text-sm">
          Como o cashback está distribuído entre {totalClients.toLocaleString("pt-BR")} clientes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] sm:h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={balanceDistribution}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {balanceDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <CustomLegend />

        <div className="mt-6 pt-4 border-t space-y-3">
          <div className="flex justify-between items-center gap-2 text-sm">
            <span className="text-muted-foreground">Saldo médio por cliente</span>
            <span className="font-semibold">R$ 67,50</span>
          </div>
          <div className="flex justify-between items-center gap-2 text-sm">
            <span className="text-muted-foreground">Total em cashback ativo</span>
            <span className="font-semibold text-emerald-600">R$ 44.775,00</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExpiringClientsWidget({ onSendReminder }: { onSendReminder?: (clientId: number) => void }) {
  const handleSendReminder = (clientId: number, clientName: string) => {
    if (onSendReminder) {
      onSendReminder(clientId);
    }
  };

  return (
    <Card className="border-orange-200 dark:border-orange-900/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Clientes em Risco
        </CardTitle>
        <CardDescription className="text-sm">
          Cashback expirando nos próximos 7 dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {expiringClients.map((client) => (
            <div
              key={client.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={client.avatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                    {client.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{client.name}</p>
                  <div className="flex items-center flex-wrap gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className="text-xs font-mono border-orange-500/50 text-orange-700 dark:text-orange-400"
                    >
                      {formatCurrency(client.balance)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      • {client.expiresIn}d
                    </span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-9 w-full sm:w-auto"
                onClick={() => handleSendReminder(client.id, client.name)}
              >
                <Send className="h-3 w-3" />
                <span>Lembrar</span>
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t">
          <Button variant="outline" className="w-full gap-2 h-10" size="sm">
            <Send className="h-4 w-4" />
            <span className="text-sm">Enviar lembrete para todos</span>
          </Button>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-muted">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">R$ 304,90</span> em cashback pode expirar esta semana.
              Envie lembretes para recuperar até 78% desse valor em vendas.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AIInsightsWidget() {
  const insights = [
    {
      id: 1,
      type: "opportunity",
      title: "Oportunidade de Resgate",
      description: "234 clientes têm saldo >R$50 mas não compraram há 15 dias",
      action: "Gerar campanha de resgate",
      actionType: "campaign",
    },
    {
      id: 2,
      type: "performance",
      title: "ROI em Alta",
      description: "Regra 'Cashback Aniversário' gerou R$45k com apenas R$3.2k em custos",
      action: "Analisar ROI detalhado",
      actionType: "analysis",
    },
    {
      id: 3,
      type: "suggestion",
      title: "Nova Regra Sugerida",
      description: "Clientes VIP respondem bem a 8% em compras >R$300",
      action: "Criar regra sugerida",
      actionType: "create",
    },
  ];

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border-indigo-200 dark:border-indigo-900/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Insights de IA
        </CardTitle>
        <CardDescription className="text-sm">
          Recomendações personalizadas para otimizar seu cashback
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="p-4 rounded-lg bg-background border hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm mb-1">{insight.title}</h4>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  {insight.description}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full sm:w-auto gap-2 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                >
                  <Sparkles className="h-3 w-3" />
                  <span className="text-xs sm:text-sm">{insight.action}</span>
                </Button>
              </div>
            </div>
          </div>
        ))}

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Insights atualizados a cada 24 horas com base no comportamento real dos clientes
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
