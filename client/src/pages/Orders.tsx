import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  ShoppingBag, 
  Filter, 
  MoreHorizontal, 
  Download
} from "lucide-react";
import { useState, useEffect } from "react";
import type { Order } from "@shared/schema";

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch("/api/orders");
        if (response.ok) {
          const data = await response.json();
          setOrders(data);
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Pedidos</h1>
            <p className="text-sm text-muted-foreground">Gerencie e processe os pedidos da loja.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 flex-1 sm:flex-none text-xs sm:text-sm" data-testid="button-export">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button className="gap-2 flex-1 sm:flex-none text-xs sm:text-sm" data-testid="button-new-order">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Pedido</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <Input 
            placeholder="Buscar pedido, cliente ou valor..." 
            className="w-full sm:max-w-sm" 
            data-testid="input-search"
          />
          <Button variant="outline" className="gap-2 w-full sm:w-auto" data-testid="button-filter">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Carregando pedidos...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                          <TableCell className="font-medium" data-testid={`text-order-id-${order.id}`}>{order.orderId}</TableCell>
                          <TableCell data-testid={`text-customer-${order.id}`}>{order.customer}</TableCell>
                          <TableCell data-testid={`text-date-${order.id}`}>{order.date}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                order.status === "Pago" ? "default" : 
                                order.status === "Entregue" ? "secondary" : 
                                order.status === "Cancelado" ? "destructive" : 
                                order.status === "Processando" ? "outline" : "default"
                              }
                              className={
                                order.status === "Pago" ? "bg-emerald-600 hover:bg-emerald-700" :
                                order.status === "Processando" ? "bg-amber-500 hover:bg-amber-600 border-transparent text-white" : ""
                              }
                              data-testid={`badge-status-${order.id}`}
                            >
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-total-${order.id}`}>{order.total}</TableCell>
                          <TableCell className="text-muted-foreground text-sm" data-testid={`text-method-${order.id}`}>{order.method}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${order.id}`}>
                                  <span className="sr-only">Abrir menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Ver Detalhes</DropdownMenuItem>
                                <DropdownMenuItem>Atualizar Status</DropdownMenuItem>
                                <DropdownMenuItem>Imprimir Etiqueta</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Cancelar Pedido</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4 p-4">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4 space-y-3" data-testid={`card-order-${order.id}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{order.orderId}</p>
                          <p className="text-sm text-muted-foreground">{order.customer}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Ver Detalhes</DropdownMenuItem>
                            <DropdownMenuItem>Atualizar Status</DropdownMenuItem>
                            <DropdownMenuItem>Imprimir Etiqueta</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Cancelar Pedido</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge 
                          variant={
                            order.status === "Pago" ? "default" : 
                            order.status === "Entregue" ? "secondary" : 
                            order.status === "Cancelado" ? "destructive" : 
                            order.status === "Processando" ? "outline" : "default"
                          }
                          className={
                            order.status === "Pago" ? "bg-emerald-600 hover:bg-emerald-700" :
                            order.status === "Processando" ? "bg-amber-500 hover:bg-amber-600 border-transparent text-white" : ""
                          }
                        >
                          {order.status}
                        </Badge>
                        <p className="font-semibold">{order.total}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Data</p>
                          <p>{order.date}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Pagamento</p>
                          <p className="text-muted-foreground">{order.method}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
