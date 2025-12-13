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
  Filter, 
  MoreHorizontal,
  ArrowUpDown,
  Package,
  Loader2
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
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Product } from "@shared/schema";

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

export default function Products() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [searchTerm, setSearchTerm] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Erro ao carregar produtos");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const response = await apiRequest("POST", "/api/products", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Sucesso!", description: "Produto adicionado com sucesso." });
      closeModal();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível adicionar o produto.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProductFormData }) => {
      const response = await apiRequest("PUT", `/api/products/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Sucesso!", description: "Produto atualizado com sucesso." });
      closeModal();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível atualizar o produto.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/products/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Sucesso!", description: "Produto excluído com sucesso." });
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível excluir o produto.", variant: "destructive" });
    },
  });

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
      price: product.price,
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

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Produtos</h1>
            <p className="text-sm text-muted-foreground">Gerencie o catálogo da sua loja.</p>
          </div>
          <Button className="gap-2" onClick={openCreateModal} data-testid="button-add-product">
            <Plus className="h-4 w-4" />
            Adicionar Produto
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar produtos..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-products"
            />
          </div>
          <Button variant="outline" className="gap-2" data-testid="button-filter">
            <Filter className="h-4 w-4" />
            Filtrar
          </Button>
          <Button variant="outline" className="gap-2 ml-auto" data-testid="button-sort">
            <ArrowUpDown className="h-4 w-4" />
            Ordenar
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center" data-testid="empty-state">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              {searchTerm ? "Nenhum produto encontrado para a busca." : "Nenhum produto cadastrado ainda."}
            </p>
            {!searchTerm && (
              <Button variant="outline" onClick={openCreateModal} data-testid="button-add-first-product">
                Adicionar primeiro produto
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden group" data-testid={`card-product-${product.id}`}>
                <div className="aspect-square w-full overflow-hidden bg-muted relative">
                  {product.image ? (
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-muted">
                      <Package className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`button-menu-${product.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditModal(product)} data-testid={`button-edit-${product.id}`}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>Duplicar</DropdownMenuItem>
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
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold truncate pr-2" title={product.name} data-testid={`text-product-name-${product.id}`}>{product.name}</h3>
                      <p className="text-sm text-muted-foreground" data-testid={`text-category-${product.id}`}>{product.category}</p>
                    </div>
                    <p className="font-semibold" data-testid={`text-price-${product.id}`}>{product.price}</p>
                  </div>
                  <div className="flex items-center justify-between mt-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={
                        product.stock > 10 ? "text-emerald-600" :
                        product.stock > 0 ? "text-amber-600" : "text-rose-600"
                      } data-testid={`text-stock-${product.id}`}>
                        {product.stock} em estoque
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8" 
                      onClick={() => openEditModal(product)}
                      data-testid={`button-edit-inline-${product.id}`}
                    >
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="product-modal">
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Estoque *</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal} data-testid="button-cancel">
                Cancelar
              </Button>
              <Button type="submit" disabled={isMutating} data-testid="button-save-product">
                {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingProduct ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O produto "{productToDelete?.name}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
