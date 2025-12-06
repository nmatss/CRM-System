import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal,
  ArrowUpDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const products = [
  {
    id: 1,
    name: "Vestido Floral Verão",
    category: "Vestidos",
    price: "R$ 299,00",
    stock: 45,
    status: "Em Estoque",
    image: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: 2,
    name: "Jaqueta Jeans Vintage",
    category: "Casacos",
    price: "R$ 380,00",
    stock: 12,
    status: "Baixo Estoque",
    image: "https://images.unsplash.com/photo-1543087903-1ac2ec7aa8c5?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: 3,
    name: "Bolsa Transversal Couro",
    category: "Acessórios",
    price: "R$ 450,00",
    stock: 28,
    status: "Em Estoque",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: 4,
    name: "Calça de Linho Bege",
    category: "Calças",
    price: "R$ 259,00",
    stock: 0,
    status: "Esgotado",
    image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: 5,
    name: "Blusa de Seda Branca",
    category: "Blusas",
    price: "R$ 189,00",
    stock: 65,
    status: "Em Estoque",
    image: "https://images.unsplash.com/photo-1564257631407-4deb1f99d992?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: 6,
    name: "Sandália de Salto Alto",
    category: "Sapatos",
    price: "R$ 320,00",
    stock: 8,
    status: "Baixo Estoque",
    image: "https://images.unsplash.com/photo-1562273138-f46be4ebdf33?auto=format&fit=crop&w=300&q=80"
  }
];

export default function Products() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
            <p className="text-muted-foreground">Gerencie o catálogo da sua loja.</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Produto
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar produtos..." 
              className="pl-9"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtrar
          </Button>
          <Button variant="outline" className="gap-2 ml-auto">
            <ArrowUpDown className="h-4 w-4" />
            Ordenar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden group">
              <div className="aspect-square w-full overflow-hidden bg-muted relative">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute top-2 right-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Editar</DropdownMenuItem>
                      <DropdownMenuItem>Duplicar</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
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
                    <h3 className="font-semibold truncate pr-2" title={product.name}>{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                  </div>
                  <p className="font-semibold">{product.price}</p>
                </div>
                <div className="flex items-center justify-between mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={
                      product.stock > 10 ? "text-emerald-600" :
                      product.stock > 0 ? "text-amber-600" : "text-rose-600"
                    }>
                      {product.stock} em estoque
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8">Editar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
