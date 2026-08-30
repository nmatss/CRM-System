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
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  MoreHorizontal,
  Download,
  Search,
  Loader2,
  ShoppingCart,
  Plus,
  X,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { downloadJsonAsCsv } from "@/lib/csvExport";
import { fetchPaginatedQuery } from "@/lib/paginatedQuery";
import { DataPagination } from "@/components/ui/data-pagination";
import {
  buildSafeOrderUpdatePayload,
  buildTransactionalOrderPayload,
  getOrderPreview,
  orderActionErrorDescription,
  orderToSafeUpdateForm,
  type OrderStatus,
  type SelectedOrderProduct,
} from "@/lib/orderTransactions";
import type { Order, Customer, Product } from "@shared/schema";

interface OrderFormData {
  customer: string;
  customerId?: number;
  orderDate: string;
  status: OrderStatus;
  method: string;
  lineItems: SelectedOrderProduct[];
}

const formatDate = (date: Date | string | null): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
};

const createInitialFormData = (): OrderFormData => ({
  customer: "",
  orderDate: new Date().toISOString().split("T")[0],
  status: "Pendente",
  method: "Cartão de Crédito",
  lineItems: [],
});

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function Orders() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [formData, setFormData] = useState<OrderFormData>(createInitialFormData);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [page, setPage] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const pageSize = 20;
  const normalizedSearch = searchTerm.trim();
  const ordersQuery = useQuery({
    queryKey: [
      "orders",
      {
        page,
        limit: pageSize,
        search: normalizedSearch,
        status: statusFilter,
        sort: "orderDate",
        order: "desc",
      },
    ],
    queryFn: () =>
      fetchPaginatedQuery<Order>({
        endpoint: "/api/v1/orders",
        page,
        limit: pageSize,
        filters: {
          search: normalizedSearch || undefined,
          status: statusFilter === "Todos" ? undefined : statusFilter,
          sort: "orderDate",
          order: "desc",
        },
      }),
  });
  const orders = ordersQuery.data?.data ?? [];
  const pagination = ordersQuery.data?.pagination;

  const customersQuery = useQuery({
    queryKey: [
      "customers",
      { page: 1, limit: 20, search: customerSearch.trim(), context: "order-form" },
    ],
    queryFn: () =>
      fetchPaginatedQuery<Customer>({
        endpoint: "/api/v1/customers",
        page: 1,
        limit: 20,
        filters: { search: customerSearch.trim() || undefined, sort: "name", order: "asc" },
      }),
    enabled: isModalOpen,
  });
  const customers = customersQuery.data?.data ?? [];

  const productsQuery = useQuery({
    queryKey: [
      "products",
      { page: 1, limit: 20, search: productSearch.trim(), context: "order-form" },
    ],
    queryFn: () =>
      fetchPaginatedQuery<Product>({
        endpoint: "/api/v1/products",
        page: 1,
        limit: 20,
        filters: { search: productSearch.trim() || undefined, sort: "name", order: "asc" },
      }),
    enabled: isModalOpen && !editingOrder,
  });
  const products = productsQuery.data?.data ?? [];
  const orderPreview = getOrderPreview(formData.lineItems);

  const createMutation = useMutation({
    mutationFn: async (data: ReturnType<typeof buildTransactionalOrderPayload>) => {
      const response = await apiRequest("POST", "/orders", data);
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Sucesso!", description: "Pedido criado com sucesso." });
      closeModal();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: orderActionErrorDescription(error, "criar"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: ReturnType<typeof buildSafeOrderUpdatePayload>;
    }) => {
      const response = await apiRequest("PUT", `/orders/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Sucesso!", description: "Pedido atualizado com sucesso." });
      closeModal();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: orderActionErrorDescription(error, "atualizar"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/orders/${id}`);
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Sucesso!", description: "Pedido cancelado com sucesso." });
      setIsDeleteDialogOpen(false);
      setOrderToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: orderActionErrorDescription(error, "cancelar"),
        variant: "destructive",
      });
    },
  });

  const openCreateModal = () => {
    setEditingOrder(null);
    setFormData(createInitialFormData());
    setCustomerSearch("");
    setProductSearch("");
    setSelectedProductId("");
    setIsModalOpen(true);
  };

  const openEditModal = (order: Order) => {
    setEditingOrder(order);
    setFormData({ ...orderToSafeUpdateForm(order), lineItems: [] });
    setCustomerSearch(order.customer);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOrder(null);
    setFormData(createInitialFormData());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOrder) {
      updateMutation.mutate({
        id: editingOrder.id,
        data: buildSafeOrderUpdatePayload(formData),
      });
      return;
    }
    if (!formData.customerId || !formData.customer.trim()) {
      toast({
        title: "Revise o pedido",
        description: "Selecione um cliente válido.",
        variant: "destructive",
      });
      return;
    }
    if (!orderPreview.isValid) {
      toast({
        title: "Revise os produtos",
        description:
          formData.lineItems.length === 0
            ? "Adicione ao menos um produto ao pedido."
            : "As quantidades devem ser positivas e não podem superar o estoque disponível.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(buildTransactionalOrderPayload({ ...formData, status: "Pendente" }));
  };

  const addSelectedProduct = () => {
    const product = products.find((item) => item.id === Number(selectedProductId));
    if (!product || formData.lineItems.some((item) => item.product.id === product.id)) return;
    setFormData((current) => ({
      ...current,
      lineItems: [...current.lineItems, { product, quantity: 1 }],
    }));
    setSelectedProductId("");
  };

  const updateLineQuantity = (productId: number, quantity: number) => {
    setFormData((current) => ({
      ...current,
      lineItems: current.lineItems.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item,
      ),
    }));
  };

  const removeLineItem = (productId: number) => {
    setFormData((current) => ({
      ...current,
      lineItems: current.lineItems.filter((item) => item.product.id !== productId),
    }));
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

  const statusOptions = [
    "Todos",
    "Pendente",
    "Processando",
    "Pago",
    "Enviado",
    "Entregue",
    "Cancelado",
  ];

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const handleExport = async () => {
    try {
      await downloadJsonAsCsv(
        "/export/orders",
        `pedidos_${new Date().toISOString().split("T")[0]}.csv`,
        [
          { key: "orderId", label: "Pedido" },
          { key: "customer", label: "Cliente" },
          { key: "orderDate", label: "Data" },
          { key: "total", label: "Total" },
          { key: "status", label: "Status" },
          { key: "items", label: "Itens" },
          { key: "method", label: "Pagamento" },
        ],
      );
      toast({ title: "Sucesso!", description: "Pedidos exportados com sucesso." });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível exportar os pedidos.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeProps = (status: string) => {
    const variant =
      status === "Pago"
        ? "default"
        : status === "Entregue"
          ? "secondary"
          : status === "Cancelado"
            ? "destructive"
            : status === "Processando"
              ? "outline"
              : "default";
    const className =
      status === "Pago"
        ? "bg-emerald-700 hover:bg-emerald-800"
        : status === "Processando"
          ? // amber-500 with white text is 2.13:1; amber-700 clears AA.
            "bg-amber-700 hover:bg-amber-800 border-transparent text-white"
          : "";
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
            <Button
              variant="outline"
              className="gap-2 flex-1 sm:flex-none text-xs sm:text-sm"
              onClick={handleExport}
              data-testid="button-export"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
            <Button
              className="gap-2 flex-1 sm:flex-none text-xs sm:text-sm"
              onClick={openCreateModal}
              data-testid="button-new-order"
            >
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
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
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
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
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
            {ordersQuery.isLoading ? (
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
            ) : ordersQuery.isError ? (
              <div
                className="flex h-64 flex-col items-center justify-center gap-3 text-center"
                role="alert"
              >
                <p className="text-destructive">Não foi possível carregar os pedidos.</p>
                <Button variant="outline" onClick={() => ordersQuery.refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : orders.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-64 text-center"
                data-testid="empty-state"
              >
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  {searchTerm
                    ? "Nenhum pedido encontrado para a busca."
                    : "Nenhum pedido cadastrado ainda."}
                </p>
                {!searchTerm && (
                  <Button
                    variant="outline"
                    onClick={openCreateModal}
                    data-testid="button-add-first-order"
                  >
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
                      {orders.map((order) => {
                        const badgeProps = getStatusBadgeProps(order.status);
                        return (
                          <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                            <TableCell
                              className="font-medium"
                              data-testid={`text-order-id-${order.id}`}
                            >
                              {order.orderId}
                            </TableCell>
                            <TableCell data-testid={`text-customer-${order.id}`}>
                              {order.customer}
                            </TableCell>
                            <TableCell data-testid={`text-date-${order.id}`}>
                              {formatDate(order.orderDate)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={badgeProps.variant as any}
                                className={`${badgeProps.className} text-xs sm:text-sm whitespace-nowrap`}
                                data-testid={`badge-status-${order.id}`}
                              >
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`text-total-${order.id}`}>
                              {formatCurrency(order.totalCents ?? Math.round(order.total * 100))}
                            </TableCell>
                            <TableCell
                              className="text-muted-foreground text-sm"
                              data-testid={`text-method-${order.id}`}
                            >
                              {order.method}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    data-testid={`button-actions-${order.id}`}
                                  >
                                    <span className="sr-only">Abrir menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => openEditModal(order)}
                                    data-testid={`button-edit-${order.id}`}
                                  >
                                    Editar dados operacionais
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => openDeleteDialog(order)}
                                    disabled={order.status === "Cancelado"}
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
                  {orders.map((order) => {
                    const badgeProps = getStatusBadgeProps(order.status);
                    return (
                      <div
                        key={order.id}
                        className="border rounded-lg p-4 space-y-3"
                        data-testid={`card-order-${order.id}`}
                      >
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
                              <DropdownMenuItem onClick={() => openEditModal(order)}>
                                Editar dados operacionais
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => openDeleteDialog(order)}
                                disabled={order.status === "Cancelado"}
                              >
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
                          <p className="font-semibold text-sm sm:text-base">
                            {formatCurrency(order.totalCents ?? Math.round(order.total * 100))}
                          </p>
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
                {pagination && (
                  <div className="p-4 pt-0">
                    <DataPagination
                      page={pagination.page}
                      totalPages={pagination.totalPages}
                      total={pagination.total}
                      label="pedidos"
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto"
          data-testid="order-modal"
        >
          <DialogHeader>
            <DialogTitle>{editingOrder ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
            <DialogDescription>
              {editingOrder
                ? "Atualize somente os dados operacionais permitidos. Totais e itens são controlados pelo servidor."
                : "Selecione cliente e produtos. Preços, estoque e total serão confirmados pelo servidor."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {editingOrder && (
                <div className="space-y-2">
                  <Label>Número do Pedido</Label>
                  <Input value={editingOrder.orderId} disabled data-testid="input-order-id" />
                </div>
              )}
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
              <Input
                id="customer-search"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Buscar cliente..."
                aria-label="Buscar cliente"
              />
              {customersQuery.isLoading ? (
                <div
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  role="status"
                >
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando clientes...
                </div>
              ) : customersQuery.isError ? (
                <div
                  className="flex items-center justify-between gap-2 text-sm text-destructive"
                  role="alert"
                >
                  <span>Não foi possível carregar os clientes.</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => customersQuery.refetch()}
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : customers.length > 0 ? (
                <Select
                  value={formData.customerId ? String(formData.customerId) : ""}
                  onValueChange={(value) => {
                    const selectedCustomer = customers.find(
                      (customer) => customer.id === Number(value),
                    );
                    if (!selectedCustomer) return;
                    setFormData({
                      ...formData,
                      customer: selectedCustomer.name,
                      customerId: selectedCustomer.id,
                    });
                  }}
                >
                  <SelectTrigger data-testid="select-customer">
                    <SelectValue placeholder="Selecione um cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={String(customer.id)}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground" role="status">
                  Nenhum cliente encontrado. Cadastre ou refine a busca antes de criar o pedido.
                </p>
              )}
            </div>
            {!editingOrder ? (
              <div className="space-y-3 rounded-lg border p-4">
                <div>
                  <Label htmlFor="product-search">Produtos *</Label>
                  <p className="text-xs text-muted-foreground">
                    A disponibilidade exibida é uma prévia; o servidor revalida estoque e preço ao
                    criar.
                  </p>
                </div>
                <Input
                  id="product-search"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Buscar produto..."
                />
                {productsQuery.isLoading ? (
                  <div
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                    role="status"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando produtos...
                  </div>
                ) : productsQuery.isError ? (
                  <div
                    className="flex items-center justify-between gap-2 text-sm text-destructive"
                    role="alert"
                  >
                    <span>Não foi possível carregar os produtos.</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => productsQuery.refetch()}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                ) : products.length === 0 ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    Nenhum produto encontrado para esta busca.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger className="flex-1" data-testid="select-product">
                        <SelectValue placeholder="Selecione um produto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => {
                          const alreadyAdded = formData.lineItems.some(
                            (item) => item.product.id === product.id,
                          );
                          return (
                            <SelectItem
                              key={product.id}
                              value={String(product.id)}
                              disabled={product.stock <= 0 || alreadyAdded}
                            >
                              {product.name} · {formatCurrency(Math.round(product.price * 100))} ·{" "}
                              {product.stock} em estoque
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addSelectedProduct}
                      disabled={!selectedProductId}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Adicionar
                    </Button>
                  </div>
                )}

                {orderPreview.rows.length === 0 ? (
                  <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    Nenhum produto adicionado ao pedido.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {orderPreview.rows.map((row) => (
                      <div
                        key={row.productId}
                        className="grid grid-cols-[1fr_90px_auto] items-end gap-2 rounded-md bg-muted/50 p-3"
                      >
                        <div className="min-w-0 text-sm">
                          <p className="truncate font-medium">{row.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(row.unitPriceCents)} cada · estoque {row.stock} ·
                            subtotal {formatCurrency(row.lineTotalCents)}
                          </p>
                          {row.hasInsufficientStock && (
                            <p className="text-xs text-destructive" role="alert">
                              Quantidade superior ao estoque disponível.
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs" htmlFor={`quantity-${row.productId}`}>
                            Quantidade
                          </Label>
                          <Input
                            id={`quantity-${row.productId}`}
                            type="number"
                            min={1}
                            max={row.stock}
                            value={row.quantity}
                            onChange={(event) =>
                              updateLineQuantity(row.productId, Number(event.target.value))
                            }
                            aria-invalid={row.hasInvalidQuantity || row.hasInsufficientStock}
                          />
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeLineItem(row.productId)}
                          aria-label={`Remover ${row.name}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div
                      className="flex justify-between border-t pt-3 font-medium"
                      aria-live="polite"
                    >
                      <span>{orderPreview.totalItems} item(ns)</span>
                      <span>Total previsto: {formatCurrency(orderPreview.totalCents)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Itens, quantidades e total são imutáveis nesta edição. O endpoint de consulta ainda
                não expõe os itens detalhados do pedido.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                {editingOrder ? (
                  <Select
                    value={formData.status}
                    onValueChange={(value: OrderStatus) =>
                      setFormData({ ...formData, status: value })
                    }
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
                      {editingOrder.status === "Cancelado" && (
                        <SelectItem value="Cancelado">Cancelado</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="status" value="Pendente" disabled data-testid="input-status" />
                )}
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
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                className="w-full sm:w-auto"
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  isMutating ||
                  !formData.customer.trim() ||
                  (!editingOrder &&
                    (customersQuery.isLoading ||
                      customersQuery.isError ||
                      !formData.customerId ||
                      !orderPreview.isValid ||
                      productsQuery.isLoading ||
                      productsQuery.isError)) ||
                  editingOrder?.status === "Cancelado"
                }
                className="w-full sm:w-auto"
                data-testid="button-save-order"
              >
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
              O pedido "{orderToDelete?.orderId}" será marcado como cancelado. Quando houver itens
              transacionais, o servidor devolverá suas quantidades ao estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto" data-testid="button-cancel-delete">
              Voltar
            </AlertDialogCancel>
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
