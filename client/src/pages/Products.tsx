import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Search,
  MoreHorizontal,
  ArrowUpDown,
  Package,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
} from "lucide-react";
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
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { capabilities, hasCapability } from "@/lib/capabilities";
import { actionErrorDescription } from "@/lib/actionErrors";
import { downloadJsonAsCsv } from "@/lib/csvExport";
import { fetchPaginatedQuery } from "@/lib/paginatedQuery";
import { DataPagination } from "@/components/ui/data-pagination";
import type { Product } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProductFormData {
  name: string;
  category: string;
  price: string;
  stock: number;
  status: string;
  image: string;
}

const initialFormData: ProductFormData = {
  name: "",
  category: "",
  price: "R$ 0,00",
  stock: 0,
  status: "Ativo",
  image: "",
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
    if (row.name || row.nome) {
      data.push({
        name: row.name || row.nome,
        category: row.category || row.categoria || "",
        price: row.price || row.preco || "R$ 0,00",
        stock: parseInt(row.stock || row.estoque || "0") || 0,
        status: row.status || "Ativo",
        image: row.image || row.imagem || "",
      });
    }
  }
  return data;
}

export default function Products() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [importData, setImportData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManageProducts = hasCapability(user, capabilities.manageProducts);

  const pageSize = 20;
  const normalizedSearch = searchTerm.trim();
  const productsQuery = useQuery({
    queryKey: [
      "products",
      {
        page,
        limit: pageSize,
        search: normalizedSearch,
        status: statusFilter,
        sort: "name",
        order: sortOrder,
      },
    ],
    queryFn: () =>
      fetchPaginatedQuery<Product>({
        endpoint: "/api/v1/products",
        page,
        limit: pageSize,
        filters: {
          search: normalizedSearch || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          sort: "name",
          order: sortOrder,
        },
      }),
  });
  const products = productsQuery.data?.data ?? [];
  const pagination = productsQuery.data?.pagination;

  const createMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const response = await apiRequest("POST", "/products", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Sucesso!", description: "Produto adicionado com sucesso." });
      closeModal();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: actionErrorDescription(error, "Não foi possível adicionar o produto."),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProductFormData }) => {
      const response = await apiRequest("PUT", `/products/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Sucesso!", description: "Produto atualizado com sucesso." });
      closeModal();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: actionErrorDescription(error, "Não foi possível atualizar o produto."),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/products/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Sucesso!", description: "Produto excluído com sucesso." });
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: actionErrorDescription(error, "Não foi possível excluir o produto."),
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
          description: `Importe no máximo ${MAX_IMPORT_ROWS} produtos por vez.`,
          variant: "destructive",
        });
        return;
      }
      setImportData(parsed);
      setIsImportDialogOpen(true);
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (importData.length === 0) return;
    setIsImporting(true);
    try {
      const response = await apiRequest("POST", "/import/products", { products: importData });
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Sucesso!",
        description: `${result.imported ?? result.success ?? importData.length} produtos importados.`,
      });
      setIsImportDialogOpen(false);
      setImportData([]);
    } catch (error) {
      toast({
        title: "Erro",
        description: actionErrorDescription(error, "Não foi possível importar os produtos."),
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      await downloadJsonAsCsv(
        "/export/products",
        `produtos_${new Date().toISOString().split("T")[0]}.csv`,
        [
          { key: "name", label: "Nome" },
          { key: "category", label: "Categoria" },
          { key: "price", label: "Preço" },
          { key: "stock", label: "Estoque" },
          { key: "status", label: "Status" },
        ],
      );
      toast({ title: "Sucesso!", description: "Produtos exportados com sucesso." });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível exportar os produtos.",
        variant: "destructive",
      });
    }
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: `R$ ${product.price ?? 0}`,
      stock: product.stock,
      status: product.status,
      image: product.image || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openDeleteDialog = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (productToDelete) {
      deleteMutation.mutate(productToDelete.id);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Produtos</h1>
            <p className="text-sm text-muted-foreground">Gerencie o catálogo da sua loja.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-import-file"
            />
            {canManageProducts && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-import-products"
              >
                <Upload className="h-4 w-4" />
                Importar
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExport}
              data-testid="button-export-products"
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            {canManageProducts && (
              <Button className="gap-2" onClick={openCreateModal} data-testid="button-add-product">
                <Plus className="h-4 w-4" />
                Adicionar Produto
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              data-testid="input-search-products"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger
              aria-label="Filtrar por status"
              className="w-full sm:w-[150px]"
              data-testid="select-product-status-filter"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Ativo">Ativos</SelectItem>
              <SelectItem value="Inativo">Inativos</SelectItem>
              <SelectItem value="Rascunho">Rascunhos</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="gap-2 ml-auto"
            data-testid="button-sort"
            onClick={() => {
              setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
              setPage(1);
            }}
          >
            <ArrowUpDown className="h-4 w-4" />
            Nome {sortOrder === "asc" ? "A–Z" : "Z–A"}
          </Button>
        </div>

        {productsQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </Card>
            ))}
          </div>
        ) : productsQuery.isError ? (
          <div
            className="flex h-64 flex-col items-center justify-center gap-3 text-center"
            role="alert"
          >
            <p className="text-destructive">Não foi possível carregar os produtos.</p>
            <Button variant="outline" onClick={() => productsQuery.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-64 text-center"
            data-testid="empty-state"
          >
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              {searchTerm
                ? "Nenhum produto encontrado para a busca."
                : "Nenhum produto cadastrado ainda."}
            </p>
            {!searchTerm && canManageProducts && (
              <Button
                variant="outline"
                onClick={openCreateModal}
                data-testid="button-add-first-product"
              >
                Adicionar primeiro produto
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {products.map((product) => (
                <Card
                  key={product.id}
                  className="overflow-hidden group"
                  data-testid={`card-product-${product.id}`}
                >
                  <div className="aspect-square w-full overflow-hidden bg-muted relative">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full aspect-square object-cover rounded-t-lg transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center bg-muted rounded-t-lg">
                        <Package className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                    {canManageProducts && (
                      <div className="absolute top-2 right-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-menu-${product.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Ações do produto {product.name}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditModal(product)}
                              data-testid={`button-edit-${product.id}`}
                            >
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => openDeleteDialog(product)}
                              data-testid={`button-delete-${product.id}`}
                            >
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                    {product.stock <= 10 && product.stock > 0 && (
                      <Badge className="absolute top-2 left-2 bg-amber-500 hover:bg-amber-600">
                        Últimas Unidades
                      </Badge>
                    )}
                    {product.stock === 0 && (
                      <Badge variant="destructive" className="absolute top-2 left-2">
                        Esgotado
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="min-w-0 flex-1">
                        <h3
                          className="font-semibold truncate"
                          title={product.name}
                          data-testid={`text-product-name-${product.id}`}
                        >
                          {product.name}
                        </h3>
                        <p
                          className="text-sm text-muted-foreground truncate"
                          data-testid={`text-category-${product.id}`}
                        >
                          {product.category}
                        </p>
                      </div>
                      <p
                        className="text-lg sm:text-xl font-semibold whitespace-nowrap"
                        data-testid={`text-price-${product.id}`}
                      >
                        {product.price}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            product.stock > 10
                              ? "text-emerald-700"
                              : product.stock > 0
                                ? "text-amber-600"
                                : "text-rose-600"
                          }
                          data-testid={`text-stock-${product.id}`}
                        >
                          {product.stock} em estoque
                        </span>
                      </div>
                      {canManageProducts && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => openEditModal(product)}
                          data-testid={`button-edit-inline-${product.id}`}
                        >
                          Editar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {pagination && (
              <DataPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                label="produtos"
                onPageChange={setPage}
              />
            )}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="max-w-full sm:max-w-[500px] max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto"
          data-testid="product-modal"
        >
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Atualize as informações do produto abaixo."
                : "Preencha os dados do novo produto."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do produto"
                required
                data-testid="input-product-name"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ex: Vestidos, Calçados..."
                  required
                  data-testid="input-product-category"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço *</Label>
                <Input
                  id="price"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="R$ 0,00"
                  required
                  data-testid="input-product-price"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Estoque *</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                  required
                  data-testid="input-product-stock"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                    <SelectItem value="Rascunho">Rascunho</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">URL da Imagem</Label>
              <Input
                id="image"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                placeholder="https://exemplo.com/imagem.jpg"
                data-testid="input-product-image"
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
                data-testid="button-save-product"
              >
                {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingProduct ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-full sm:max-w-md" data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O produto "{productToDelete?.name}" será removido
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto mt-0" data-testid="button-cancel-delete">
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
          className="max-w-full sm:max-w-[600px] max-h-[100dvh] sm:max-h-[90vh]"
          data-testid="import-dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Produtos
            </DialogTitle>
            <DialogDescription>Revise os dados do arquivo CSV antes de importar.</DialogDescription>
          </DialogHeader>
          {importData.length > 0 ? (
            <div className="overflow-x-auto border rounded-md">
              <ScrollArea className="max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Nome</TableHead>
                      <TableHead className="whitespace-nowrap">Categoria</TableHead>
                      <TableHead className="whitespace-nowrap">Preço</TableHead>
                      <TableHead className="whitespace-nowrap">Estoque</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="whitespace-nowrap">{item.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.category}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.price}</TableCell>
                        <TableCell className="whitespace-nowrap">{item.stock}</TableCell>
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
              onClick={() => {
                setIsImportDialogOpen(false);
                setImportData([]);
              }}
              className="w-full sm:w-auto"
              data-testid="button-cancel-import"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={importData.length === 0 || isImporting}
              className="w-full sm:w-auto"
              data-testid="button-confirm-import"
            >
              {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importar {importData.length} produtos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
