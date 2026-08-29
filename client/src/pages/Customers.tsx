import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerDetail } from "@/components/customers/CustomerDetail";
import {
  MoreHorizontal,
  Plus,
  Tag,
  Search,
  UserPlus,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  Eye,
} from "lucide-react";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  describeImportPlan,
  describeImportResult,
  isNoOpImport,
  type ImportOutcome,
} from "@/lib/importPreview";
import { downloadJsonAsCsv } from "@/lib/csvExport";
import { fetchPaginatedQuery } from "@/lib/paginatedQuery";
import { DataPagination } from "@/components/ui/data-pagination";
import type { Customer } from "@shared/schema";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

const formatDate = (date: Date | string | null): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
};

const formatDateForInput = (date: Date | string | null): string => {
  if (!date) return new Date().toISOString().split("T")[0];
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
};

interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  segment: string;
  ltv: string;
  lastPurchase: string;
  favoriteCategory: string;
}

const initialFormData: CustomerFormData = {
  name: "",
  email: "",
  phone: "",
  segment: "Novo",
  ltv: "0",
  lastPurchase: new Date().toISOString().split("T")[0],
  favoriteCategory: "",
};

const MAX_IMPORT_FILE_BYTES = 1024 * 1024;
const MAX_IMPORT_ROWS = 1000;

function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    // Every non-empty line is forwarded. Dropping rows here would hide them from
    // the user; the server validates each one and reports it by line number.
    if (values.some((value) => value !== "")) {
      // Only what the file actually carries. Defaulting `lastPurchase` to today
      // invented a purchase, and defaulting `ltv` to zero invented a value.
      data.push({
        name: row.name || row.nome || "",
        email: row.email || row.e_mail || "",
        phone: row.phone || row.telefone || "",
        segment: row.segment || row.segmento || "Novo",
        ltv: row.ltv || "",
        lastPurchase: row.lastpurchase || row.ultimacompra || "",
        favoriteCategory: row.favoritecategory || row.categoriafavorita || "",
      });
    }
  }
  return data;
}

export default function Customers() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportOutcome | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [searchTerm, setSearchTerm] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [importData, setImportData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const pageSize = 20;
  const normalizedSearch = searchTerm.trim();
  const customersQuery = useQuery({
    queryKey: [
      "customers",
      { page, limit: pageSize, search: normalizedSearch, segment: segmentFilter },
    ],
    queryFn: () =>
      fetchPaginatedQuery<Customer>({
        endpoint: "/api/v1/customers",
        page,
        limit: pageSize,
        filters: {
          search: normalizedSearch || undefined,
          segment: segmentFilter === "all" ? undefined : segmentFilter,
          sort: "name",
          order: "asc",
        },
      }),
  });
  const customers = customersQuery.data?.data ?? [];
  const pagination = customersQuery.data?.pagination;

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const response = await apiRequest("POST", "/customers", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Sucesso!", description: "Cliente adicionado com sucesso." });
      closeModal();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o cliente.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CustomerFormData }) => {
      const response = await apiRequest("PUT", `/customers/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Sucesso!", description: "Cliente atualizado com sucesso." });
      closeModal();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o cliente.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/customers/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Sucesso!", description: "Cliente excluído com sucesso." });
      setIsDeleteDialogOpen(false);
      setCustomerToDelete(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o cliente.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      toast({
        title: "Arquivo muito grande",
        description: "Importe arquivos CSV de até 1 MB.",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > MAX_IMPORT_ROWS) {
        toast({
          title: "Muitas linhas",
          description: `Importe no máximo ${MAX_IMPORT_ROWS} clientes por vez.`,
          variant: "destructive",
        });
        return;
      }
      setImportData(parsed);
      setImportPreview(null);
      setIsImportDialogOpen(true);
      void previewImport(parsed);
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /** Asks the server what a commit would do, without writing anything. */
  const previewImport = async (rows: Record<string, string>[]) => {
    setIsPreviewing(true);
    try {
      const response = await apiRequest("POST", "/import/customers", {
        rows,
        mode: "dry-run",
        onDuplicate: "skip",
      });
      setImportPreview((await response.json()) as ImportOutcome);
    } catch {
      setImportPreview(null);
      toast({
        title: "Erro",
        description: "Não foi possível analisar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (importData.length === 0) return;
    setIsImporting(true);
    try {
      const response = await apiRequest("POST", "/import/customers", {
        rows: importData,
        mode: "commit",
        onDuplicate: "skip",
      });
      const result = (await response.json()) as ImportOutcome;
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({
        title: "Importação concluída",
        description: describeImportResult(result, "clientes"),
      });
      setIsImportDialogOpen(false);
      setImportData([]);
      setImportPreview(null);
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível importar os clientes.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      await downloadJsonAsCsv(
        "/export/customers",
        `clientes_${new Date().toISOString().split("T")[0]}.csv`,
        [
          { key: "name", label: "Nome" },
          { key: "email", label: "E-mail" },
          { key: "phone", label: "Telefone" },
          { key: "segment", label: "Segmento" },
          { key: "ltv", label: "LTV" },
          { key: "lastPurchase", label: "Última compra" },
          { key: "favoriteCategory", label: "Categoria favorita" },
        ],
      );
      toast({ title: "Sucesso!", description: "Clientes exportados com sucesso." });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível exportar os clientes.",
        variant: "destructive",
      });
    }
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || "",
      segment: customer.segment,
      ltv: `R$ ${customer.ltv ?? 0}`,
      lastPurchase: formatDateForInput(customer.lastPurchase),
      favoriteCategory: customer.favoriteCategory || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openDeleteDialog = (customer: Customer) => {
    setCustomerToDelete(customer);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (customerToDelete) {
      deleteMutation.mutate(customerToDelete.id);
    }
  };

  const openDetailView = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailOpen(true);
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Clienteling</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-import-file"
            />
            <Button
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-import-customers"
            >
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <Button
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              onClick={handleExport}
              data-testid="button-export-customers"
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button
              className="gap-2 w-full sm:w-auto"
              onClick={openCreateModal}
              data-testid="button-add-customer"
            >
              <Plus className="h-4 w-4" />
              Adicionar Cliente
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
            <CardTitle className="text-base font-semibold">Lista de Clientes</CardTitle>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou estilo..."
                  className="h-8 w-full sm:w-[250px] pl-9"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  data-testid="input-search-customers"
                />
              </div>
              <Select
                value={segmentFilter}
                onValueChange={(value) => {
                  setSegmentFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  aria-label="Filtrar por segmento"
                  className="h-8 w-full sm:w-[150px]"
                  data-testid="select-segment-filter"
                >
                  <SelectValue placeholder="Segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="Novo">Novo</SelectItem>
                  <SelectItem value="Regular">Regular</SelectItem>
                  <SelectItem value="Em Risco">Em Risco</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {customersQuery.isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                    <Skeleton className="h-6 w-[80px]" />
                  </div>
                ))}
              </div>
            ) : customersQuery.isError ? (
              <div
                className="flex h-64 flex-col items-center justify-center gap-3 text-center"
                role="alert"
              >
                <p className="text-destructive">Não foi possível carregar os clientes.</p>
                <Button variant="outline" onClick={() => customersQuery.refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : customers.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-64 text-center"
                data-testid="empty-state"
              >
                <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  {searchTerm
                    ? "Nenhum cliente encontrado para a busca."
                    : "Nenhum cliente cadastrado ainda."}
                </p>
                {!searchTerm && (
                  <Button
                    variant="outline"
                    onClick={openCreateModal}
                    data-testid="button-add-first-customer"
                  >
                    Adicionar primeiro cliente
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Segmento</TableHead>
                        <TableHead>Categoria Favorita</TableHead>
                        <TableHead>Lifetime Value (LTV)</TableHead>
                        <TableHead>Última Compra</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer) => (
                        <TableRow
                          key={customer.id}
                          data-testid={`row-customer-${customer.id}`}
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() => openDetailView(customer)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarImage
                                  src={customer.image || undefined}
                                  alt={customer.name}
                                />
                                <AvatarFallback>
                                  {customer.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span
                                  className="font-medium"
                                  data-testid={`text-customer-name-${customer.id}`}
                                >
                                  {customer.name}
                                </span>
                                <span
                                  className="text-xs text-muted-foreground"
                                  data-testid={`text-customer-email-${customer.id}`}
                                >
                                  {customer.email}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                customer.segment === "VIP"
                                  ? "default"
                                  : customer.segment === "Em Risco"
                                    ? "destructive"
                                    : customer.segment === "Novo"
                                      ? "secondary"
                                      : "outline"
                              }
                              className={
                                customer.segment === "VIP"
                                  ? "bg-purple-600 hover:bg-purple-700"
                                  : ""
                              }
                              data-testid={`badge-segment-${customer.id}`}
                            >
                              {customer.segment}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Tag className="h-3 w-3" />
                              {customer.favoriteCategory || "N/A"}
                            </div>
                          </TableCell>
                          <TableCell
                            className="font-medium"
                            data-testid={`text-ltv-${customer.id}`}
                          >
                            {customer.ltv}
                          </TableCell>
                          <TableCell
                            className="text-muted-foreground text-sm"
                            data-testid={`text-last-purchase-${customer.id}`}
                          >
                            {formatDate(customer.lastPurchase)}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-actions-${customer.id}`}
                                >
                                  <span className="sr-only">Abrir menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openDetailView(customer)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Visão 360°
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openEditModal(customer)}
                                  data-testid={`button-edit-${customer.id}`}
                                >
                                  Editar Cliente
                                </DropdownMenuItem>
                                <DropdownMenuItem>Criar Pedido</DropdownMenuItem>
                                <DropdownMenuItem>Registrar Interação</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => openDeleteDialog(customer)}
                                  data-testid={`button-delete-${customer.id}`}
                                >
                                  Excluir Cliente
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="md:hidden space-y-4">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-accent/50 transition-colors"
                      data-testid={`card-customer-${customer.id}`}
                      onClick={() => openDetailView(customer)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={customer.image || undefined} alt={customer.name} />
                            <AvatarFallback>
                              {customer.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">{customer.email}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDetailView(customer)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Visão 360°
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEditModal(customer)}>
                              Editar Cliente
                            </DropdownMenuItem>
                            <DropdownMenuItem>Criar Pedido</DropdownMenuItem>
                            <DropdownMenuItem>Registrar Interação</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => openDeleteDialog(customer)}
                            >
                              Excluir Cliente
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={
                            customer.segment === "VIP"
                              ? "default"
                              : customer.segment === "Em Risco"
                                ? "destructive"
                                : customer.segment === "Novo"
                                  ? "secondary"
                                  : "outline"
                          }
                          className={
                            customer.segment === "VIP" ? "bg-purple-600 hover:bg-purple-700" : ""
                          }
                        >
                          {customer.segment}
                        </Badge>
                        {customer.favoriteCategory && (
                          <Badge variant="outline" className="gap-1">
                            <Tag className="h-3 w-3" />
                            {customer.favoriteCategory}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">LTV</p>
                          <p className="font-medium">{customer.ltv}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Última Compra</p>
                          <p className="text-muted-foreground">
                            {formatDate(customer.lastPurchase)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {pagination && (
                  <DataPagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    total={pagination.total}
                    label="clientes"
                    onPageChange={setPage}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="w-full max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto"
          data-testid="customer-modal"
        >
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? "Atualize as informações do cliente abaixo."
                : "Preencha os dados do novo cliente."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                  required
                  data-testid="input-customer-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  required
                  data-testid="input-customer-email"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  data-testid="input-customer-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="segment">Segmento *</Label>
                <Select
                  value={formData.segment}
                  onValueChange={(value) => setFormData({ ...formData, segment: value })}
                >
                  <SelectTrigger data-testid="select-segment">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Novo">Novo</SelectItem>
                    <SelectItem value="Frequente">Frequente</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                    <SelectItem value="Em Risco">Em Risco</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ltv">LTV</Label>
                <Input
                  id="ltv"
                  value={formData.ltv}
                  onChange={(e) => setFormData({ ...formData, ltv: e.target.value })}
                  placeholder="R$ 0,00"
                  data-testid="input-customer-ltv"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastPurchase">Última Compra</Label>
                <Input
                  id="lastPurchase"
                  type="date"
                  value={formData.lastPurchase}
                  onChange={(e) => setFormData({ ...formData, lastPurchase: e.target.value })}
                  data-testid="input-customer-last-purchase"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="favoriteCategory">Categoria Favorita</Label>
              <Input
                id="favoriteCategory"
                value={formData.favoriteCategory}
                onChange={(e) => setFormData({ ...formData, favoriteCategory: e.target.value })}
                placeholder="Ex: Vestidos, Calçados, Acessórios..."
                data-testid="input-customer-category"
              />
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
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
                disabled={isMutating}
                className="w-full sm:w-auto"
                data-testid="button-save-customer"
              >
                {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingCustomer ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-full max-w-[95vw] sm:max-w-lg" data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cliente "{customerToDelete?.name}" será removido
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto" data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent
          className="w-full max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
          data-testid="import-dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Clientes
            </DialogTitle>
            <DialogDescription>Revise os dados do arquivo CSV antes de importar.</DialogDescription>
          </DialogHeader>
          <div
            className="rounded-md border bg-muted/40 p-3 text-sm"
            role="status"
            data-testid="import-preview"
          >
            {isPreviewing ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando o arquivo...
              </span>
            ) : importPreview ? (
              <>
                <p className="font-medium">{describeImportPlan(importPreview, "clientes")}</p>
                {importPreview.totals.duplicates > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Linhas já existentes são ignoradas: reimportar o mesmo arquivo não duplica a
                    base.
                  </p>
                )}
                {importPreview.issues.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-destructive">
                    {importPreview.issues.slice(0, 5).map((issue) => (
                      <li key={`${issue.row}-${issue.field ?? ""}-${issue.message}`}>
                        Linha {issue.row}
                        {issue.field ? ` · ${issue.field}` : ""}: {issue.message}
                      </li>
                    ))}
                    {importPreview.totalIssues > 5 && (
                      <li>e mais {importPreview.totalIssues - 5} problema(s).</li>
                    )}
                  </ul>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">
                Nenhuma análise disponível para este arquivo.
              </span>
            )}
          </div>
          {importData.length > 0 ? (
            <div className="overflow-x-auto -mx-6 sm:mx-0">
              <ScrollArea className="max-h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Nome</TableHead>
                      <TableHead className="min-w-[200px]">Email</TableHead>
                      <TableHead className="min-w-[100px]">Segmento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="min-w-[150px]">{item.name}</TableCell>
                        <TableCell className="min-w-[200px]">{item.email}</TableCell>
                        <TableCell className="min-w-[100px]">{item.segment}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Nenhum dado válido encontrado no arquivo.
            </p>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setIsImportDialogOpen(false);
                setImportData([]);
                setImportPreview(null);
              }}
              data-testid="button-cancel-import"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={
                importData.length === 0 ||
                isImporting ||
                isPreviewing ||
                (importPreview !== null && isNoOpImport(importPreview))
              }
              className="w-full sm:w-auto"
              data-testid="button-confirm-import"
            >
              {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {importPreview
                ? `Importar ${importPreview.totals.created + importPreview.totals.updated} clientes`
                : `Importar ${importData.length} clientes`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerDetail
        customer={selectedCustomer}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </Layout>
  );
}
