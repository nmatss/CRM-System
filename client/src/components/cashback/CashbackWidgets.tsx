import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AlertCircle, TrendingUp } from "lucide-react";
import type { Customer } from "@shared/schema";

export interface CashbackDistributionItem {
  range: string;
  count: number;
}
export interface ExpiringCashbackItem {
  customer: Customer;
  balance: number;
  expiresAt: string;
}

const colors = ["#64748b", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface QueryWidgetProps {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function BalanceDistributionWidget({
  data,
  isLoading,
  isError,
  onRetry,
}: QueryWidgetProps & { data: CashbackDistributionItem[] }) {
  const totalCustomers = data.reduce((sum, item) => sum + item.count, 0);
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Distribuição de saldos
        </CardTitle>
        <CardDescription>Quantidade de clientes por faixa de saldo atual</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : isError ? (
          <WidgetError onRetry={onRetry} />
        ) : totalCustomers === 0 ? (
          <WidgetEmpty text="Nenhum saldo de cashback encontrado." />
        ) : (
          <>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="range"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                  >
                    {data.map((item, index) => (
                      <Cell key={item.range} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} clientes`, "Quantidade"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.map((item, index) => (
                <div
                  key={item.range}
                  className="flex items-center justify-between gap-3 rounded border p-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    />
                    {item.range}
                  </span>
                  <span className="font-medium">
                    {item.count} ({Math.round((item.count / totalCustomers) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {totalCustomers} clientes considerados. A API não fornece o valor financeiro total dos
              saldos.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ExpiringClientsWidget({
  data,
  isLoading,
  isError,
  onRetry,
}: QueryWidgetProps & { data: ExpiringCashbackItem[] }) {
  const totalExpiring = data.reduce((sum, item) => sum + item.balance, 0);
  return (
    <Card className="border-orange-200 dark:border-orange-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Cashback próximo do vencimento
        </CardTitle>
        <CardDescription>Dados reais dos próximos 7 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <WidgetError onRetry={onRetry} />
        ) : data.length === 0 ? (
          <WidgetEmpty text="Nenhum cashback vence nos próximos 7 dias." />
        ) : (
          <>
            <div className="space-y-3">
              {data.map((item) => (
                <div
                  key={`${item.customer.id}-${item.expiresAt}`}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={item.customer.image || undefined} />
                    <AvatarFallback>{item.customer.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.customer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence em {new Date(item.expiresAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-orange-700 dark:text-orange-400">
                    {formatCurrency(item.balance)}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t pt-4 text-sm">
              <span className="text-muted-foreground">Total próximo do vencimento: </span>
              <strong>{formatCurrency(totalExpiring)}</strong>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              O sistema ainda não possui endpoint de envio de lembretes; nenhuma mensagem foi
              disparada.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WidgetError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-3" role="alert">
      <p className="text-sm text-destructive">Não foi possível carregar os dados.</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
function WidgetEmpty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>;
}
