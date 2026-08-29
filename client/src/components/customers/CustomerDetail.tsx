import { useQuery } from "@tanstack/react-query";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, Phone, ShoppingBag, Wallet, MessageSquare } from "lucide-react";
import type { CashbackTransaction, Customer, CustomerInteraction, Order } from "@shared/schema";

interface CustomerDetailProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
interface Customer360Response {
  customer: Customer;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrder?: Order;
  cashbackBalance: number;
  interactions: CustomerInteraction[];
}
interface CustomerHistoryResponse {
  customer: Customer;
  orders: Order[];
  totalOrders: number;
  totalSpent: number;
}
interface CustomerCashbackResponse {
  customer: Customer;
  balance: number;
  transactions: CashbackTransaction[];
}

async function fetchCustomerData<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Erro ao carregar dados do cliente (${response.status})`);
  return response.json();
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const formatDate = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "—";

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex min-h-48 flex-col items-center justify-center gap-3 text-center"
      role="alert"
    >
      <p className="text-sm text-destructive">Não foi possível carregar esta seção.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
function LoadingSection() {
  return (
    <div className="space-y-3 py-4" aria-label="Carregando dados do cliente">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function CustomerDetail({ customer, open, onOpenChange }: CustomerDetailProps) {
  const customerId = customer?.id;
  const enabled = open && customerId !== undefined;
  const overviewQuery = useQuery<Customer360Response>({
    queryKey: ["customer-360", customerId],
    queryFn: () => fetchCustomerData(`/api/v1/customers/${customerId}/360`),
    enabled,
  });
  const historyQuery = useQuery<CustomerHistoryResponse>({
    queryKey: ["customer-history", customerId],
    queryFn: () => fetchCustomerData(`/api/v1/customers/${customerId}/history`),
    enabled,
  });
  const cashbackQuery = useQuery<CustomerCashbackResponse>({
    queryKey: ["customer-cashback", customerId],
    queryFn: () => fetchCustomerData(`/api/v1/customers/${customerId}/cashback`),
    enabled,
  });

  if (!customer) return null;
  const resolvedCustomer = overviewQuery.data?.customer ?? customer;
  const credited =
    cashbackQuery.data?.transactions
      .filter((item) => item.type === "credit")
      .reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const redeemed =
    cashbackQuery.data?.transactions
      .filter((item) => item.type === "debit")
      .reduce((sum, item) => sum + item.amount, 0) ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <div className="mb-4 flex items-center gap-4 pr-8">
            <Avatar className="h-16 w-16">
              <AvatarImage src={resolvedCustomer.image || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-xl text-white">
                {resolvedCustomer.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-2xl">{resolvedCustomer.name}</SheetTitle>
              <SheetDescription className="mt-1 flex items-center gap-2">
                <Mail className="h-3 w-3" />
                <span className="truncate">{resolvedCustomer.email}</span>
              </SheetDescription>
            </div>
            <Badge>{resolvedCustomer.segment}</Badge>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex min-w-full sm:grid sm:grid-cols-4">
              <TabsTrigger value="overview">Resumo</TabsTrigger>
              <TabsTrigger value="purchases">Compras</TabsTrigger>
              <TabsTrigger value="cashback">Cashback</TabsTrigger>
              <TabsTrigger value="interactions">Interações</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-6 space-y-4">
            {overviewQuery.isLoading ? (
              <LoadingSection />
            ) : overviewQuery.isError ? (
              <QueryError onRetry={() => overviewQuery.refetch()} />
            ) : overviewQuery.data ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard label="Pedidos" value={String(overviewQuery.data.totalOrders)} />
                  <MetricCard
                    label="Total gasto"
                    value={formatCurrency(overviewQuery.data.totalSpent)}
                  />
                  <MetricCard
                    label="Ticket médio"
                    value={formatCurrency(overviewQuery.data.averageOrderValue)}
                  />
                  <MetricCard
                    label="Saldo cashback"
                    value={formatCurrency(overviewQuery.data.cashbackBalance)}
                    accent
                  />
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Contato e relacionamento</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {resolvedCustomer.email}
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {resolvedCustomer.phone || "Não informado"}
                    </p>
                    <p>
                      Última compra:{" "}
                      {formatDate(
                        overviewQuery.data.lastOrder?.orderDate ?? resolvedCustomer.lastPurchase,
                      )}
                    </p>
                    <p>
                      Categoria favorita cadastrada:{" "}
                      {resolvedCustomer.favoriteCategory || "Não informada"}
                    </p>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="purchases" className="mt-6">
            {historyQuery.isLoading ? (
              <LoadingSection />
            ) : historyQuery.isError ? (
              <QueryError onRetry={() => historyQuery.refetch()} />
            ) : historyQuery.data?.orders.length ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingBag className="h-4 w-4" />
                    Histórico de pedidos
                  </CardTitle>
                  <CardDescription>
                    {historyQuery.data.totalOrders} pedidos ·{" "}
                    {formatCurrency(historyQuery.data.totalSpent)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyQuery.data.orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>{formatDate(order.orderDate)}</TableCell>
                          <TableCell>{order.orderId}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(order.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <EmptySection text="Nenhum pedido registrado para este cliente." />
            )}
          </TabsContent>

          <TabsContent value="cashback" className="mt-6 space-y-4">
            {cashbackQuery.isLoading ? (
              <LoadingSection />
            ) : cashbackQuery.isError ? (
              <QueryError onRetry={() => cashbackQuery.refetch()} />
            ) : cashbackQuery.data ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <MetricCard
                    label="Saldo atual"
                    value={formatCurrency(cashbackQuery.data.balance)}
                    accent
                  />
                  <MetricCard label="Total creditado" value={formatCurrency(credited)} />
                  <MetricCard label="Total resgatado" value={formatCurrency(redeemed)} />
                </div>
                {cashbackQuery.data.transactions.length ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Wallet className="h-4 w-4" />
                        Transações
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cashbackQuery.data.transactions.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{formatDate(item.createdAt)}</TableCell>
                              <TableCell>
                                <Badge variant={item.type === "credit" ? "default" : "secondary"}>
                                  {item.type === "credit" ? "Crédito" : "Resgate"}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.description}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.amount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(item.balance)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <EmptySection text="Nenhuma transação de cashback registrada." />
                )}
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="interactions" className="mt-6">
            {overviewQuery.isLoading ? (
              <LoadingSection />
            ) : overviewQuery.isError ? (
              <QueryError onRetry={() => overviewQuery.refetch()} />
            ) : overviewQuery.data?.interactions.length ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4" />
                    Interações recentes
                  </CardTitle>
                  <CardDescription>Últimas 10 interações registradas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overviewQuery.data.interactions.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{item.type}</p>
                        <Badge variant="outline">{item.channel}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.notes || "Sem observações"}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <EmptySection text="Nenhuma interação registrada para este cliente." />
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className={`text-xl font-bold ${accent ? "text-emerald-600" : ""}`}>
        {value}
      </CardContent>
    </Card>
  );
}
function EmptySection({ text }: { text: string }) {
  return <div className="py-16 text-center text-sm text-muted-foreground">{text}</div>;
}
