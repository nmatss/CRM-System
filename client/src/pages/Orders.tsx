import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ShoppingBag, 
  Filter, 
  MoreHorizontal, 
  Download,
  Search,
  Loader2,
  ShoppingCart
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Order, Customer } from "@shared/schema";

interface OrderFormData {
  orderId: string;
  customer: string;
  customerId?: number;
  orderDate: string;
  total: string;
  status: string;
  items: number;
  method: string;
}

const formatDate = (date: Date | string | null): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
};

const formatDateForInput = (date: Date | string | null): string => {
  if (!date) return new Date().toISOString().split('T')[0];
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split('T')[0];
};

const generateOrderId = () => {
  const prefix = "PED";
  const number = Math.floor(Math.random() * 900000) + 100000;
  return `${prefix}${number}`;
};

const initialFormData: OrderFormData = {
  orderId: generateOrderId(),
  customer: "",
  orderDate: new Date().toISOString().split('T')[0],
  total: "R$ 0,00",
  status: "Pendente",
  items: 1,
  method: "Cartão de Crédito",
};

export default function Orders() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [formData, setFormData] = useState<OrderFormData>(initialFormData);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: async () => {
      const response = await fetch("/api/v1/orders");
      if (!response.ok) throw new Error("Erro ao carregar pedidos");
      return response.json();
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const response = await fetch("/api/v1/customers");
      if (!response.ok) throw new Error("Erro ao carregar clientes");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: OrderFormData) => {
      const response = await apiRequest("POST", "/orders", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Sucesso!", description: "Pedido criado com sucesso." });
      closeModal();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível criar o pedido.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<OrderFormData> }) => {
      const response = await apiRequest("PUT", `/orders/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Sucesso!", description: "Pedido atualizado com sucesso." });
      closeModal();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível atualizar o pedido.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/orders/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Sucesso!", description: "Pedido cancelado com sucesso." });
      setIsDeleteDialogOpen(false);
      setOrderToDelete(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível cancelar o pedido.", variant: "destructive" });
    },
  });

  const openCreateModal = () => {
    setEditingOrder(null);
    setFormData({ ...initialFormData, orderId: generateOrderId() });
    setIsModalOpen(true);
  };

  const openEditModal = (order: Order) => {
    setEditingOrder(order);
    setFormData({
      orderId: order.orderId,
      customer: order.customer,
      customerId: order.customerId || undefined,
      orderDate: formatDateForInput(order.orderDate),
      total: `R$ ${(order.total ?? 0).toFixed(2).replace('.', ',')}`,
      status: order.status,
      items: order.items,
      method: order.method,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOrder(null);
    setFormData({ ...initialFormData, orderId: generateOrderId() });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openDeleteDialog = (order: Order) => {
    setOrderToDelete(order);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (orderToDelete) {
      deleteMutation.mutate(orderToDelete.id);
    }
  };

  const filteredOrders = orders.filter(
    (order) => {
      const matchesSearch = order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(order.total).includes(searchTerm);
      const matchesStatus = statusFilter === "Todos" || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    }
  );

  const statusOptions = ["Todos", "Pendente", "Processando", "Pago", "Enviado", "Entregue", "Cancelado"];

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const getStatusBadgeProps = (status: string) => {
    const variant = status === "Pago" ? "default" : 
                    status === "Entregue" ? "secondary" : 
                    status === "Cancelado" ? "destructive" : 
                    status === "Processando" ? "outline" : "default";
    const className = status === "Pago" ? "bg-emerald-600 hover:bg-emerald-700" :
                      status === "Processando" ? "bg-amber-500 hover:bg-amber-600 border-transparent text-white" : "";
    return { variant, className };
  };

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
            <Button className="gap-2 flex-1 sm:flex-none text-xs sm:text-sm" onClick={openCreateModal} data-testid="button-new-order">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Pedido</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pedido, cliente ou valor..."
                className="w-full pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>

          <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            {statusOptions.map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="whitespace-nowrap text-xs sm:text-sm px-3 py-1.5 flex-shrink-0"
                data-testid={`filter-${status.toLowerCase()}`}
              >
                {status}
              </Button>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-4 p-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-[100px]" />
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-4 w-[80px]" />
                    <Skeleton className="h-6 w-[80px]" />
                    <Skeleton className="h-4 w-[100px]" />
                  </div>
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center" data-testid="empty-state">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  {searchTerm ? "Nenhum pedido encontrado para a busca." : "Nenhum pedido cadastrado ainda."}
                </p>
                {!searchTerm && (
                  <Button variant="outline" onClick={openCreateModal} data-testid="button-add-first-order">
                    Criar primeiro pedido
                  </Button>
                )}
              </div>
            ) : (
              <>
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
                      {filteredOrders.map((order) => {
                        const badgeProps = getStatusBadgeProps(order.status);
                        return (
                          <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                            <TableCell className="font-medium" data-testid={`text-order-id-${order.id}`}>{order.orderId}</TableCell>
                            <TableCell data-testid={`text-customer-${order.id}`}>{order.customer}</TableCell>
                            <TableCell data-testid={`text-date-${order.id}`}>{formatDate(order.orderDate)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={badgeProps.variant as any}
                                className={`${badgeProps.className} text-xs sm:text-sm whitespace-nowrap`}
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
                                  <DropdownMenuItem onClick={() => openEditModal(order)} data-testid={`button-edit-${order.id}`}>
                                    Ver Detalhes
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEditModal(order)}>
                                    Atualizar Status
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>Imprimir Etiqueta</DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => openDeleteDialog(order)}
                                    data-testid={`button-delete-${order.id}`}
                                  >
                                    Cancelar Pedido
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                <div className="md:hidden space-y-4 p-4">
                  {filteredOrders.map((order) => {
                    const badgeProps = getStatusBadgeProps(order.status);
                    return (
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
                              <DropdownMenuItem onClick={() => openEditModal(order)}>Ver Detalhes</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditModal(order)}>Atualizar Status</DropdownMenuItem>
                              <DropdownMenuItem>Imprimir Etiqueta</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(order)}>
                                Cancelar Pedido
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={badgeProps.variant as any}
                            className={`${badgeProps.className} text-xs sm:text-sm whitespace-nowrap`}
                          >
                            {order.status}
                          </Badge>
                          <p className="font-semibold text-sm sm:text-base">{order.total}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Data</p>
                            <p>{formatDate(order.orderDate)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Pagamento</p>
                            <p className="text-muted-foreground">{order.method}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" data-testid="order-modal">
          <DialogHeader>
            <DialogTitle>{editingOrder ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
            <DialogDescription>
              {editingOrder
                ? "Atualize as informações do pedido abaixo."
                : "Preencha os dados do novo pedido."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orderId">Número do Pedido</Label>
                <Input
                  id="orderId"
                  value={formData.orderId}
                  disabled
                  data-testid="input-order-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderDate">Data</Label>
                <Input
                  id="orderDate"
                  type="date"
                  value={formData.orderDate}
                  onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                  required
                  data-testid="input-order-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer">Cliente *</Label>
              {customers.length > 0 ? (
                <Select
                  value={formData.customer}
                  onValueChange={(value) => {
                    const selectedCustomer = customers.find(c => c.name === value);
                    setFormData({ 
                      ...formData, 
                      customer: value, 
                      customerId: selectedCustomer?.id 
                    });
                  }}
                >
                  <SelectTrigger data-testid="select-customer">
                    <SelectValue placeholder="Selecione um cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.name}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="customer"
                  value={formData.customer}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  placeholder="Nome do cliente"
                  required
                  data-testid="input-order-customer"
                />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total">Total *</Label>
                <Input
                  id="total"
                  value={formData.total}
                  onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                  placeholder="R$ 0,00"
                  required
                  data-testid="input-order-total"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="items">Qtd. Itens</Label>
                <Input
                  id="items"
                  type="number"
                  value={formData.items}
                  onChange={(e) => setFormData({ ...formData, items: parseInt(e.target.value) || 1 })}
                  min={1}
                  data-testid="input-order-items"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Processando">Processando</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Enviado">Enviado</SelectItem>
                    <SelectItem value="Entregue">Entregue</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">Pagamento</Label>
                <Select
                  value={formData.method}
                  onValueChange={(value) => setFormData({ ...formData, method: value })}
                >
                  <SelectTrigger data-testid="select-method">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                    <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeModal} className="w-full sm:w-auto" data-testid="button-cancel">
                Cancelar
              </Button>
              <Button type="submit" disabled={isMutating} className="w-full sm:w-auto" data-testid="button-save-order">
                {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingOrder ? "Salvar" : "Criar Pedido"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg" data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O pedido "{orderToDelete?.orderId}" será cancelado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto" data-testid="button-cancel-delete">Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancelar Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
