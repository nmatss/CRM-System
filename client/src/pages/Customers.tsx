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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Plus, Filter, Tag } from "lucide-react";

const customers = [
  {
    id: "C-001",
    name: "Ana Silva",
    email: "ana.silva@email.com",
    segment: "VIP",
    ltv: "R$ 15.450,00",
    lastPurchase: "2 dias atrás",
    favoriteCategory: "Vestidos",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80"
  },
  {
    id: "C-002",
    name: "Juliana Costa",
    email: "ju.costa@email.com",
    segment: "Regular",
    ltv: "R$ 4.200,00",
    lastPurchase: "5 horas atrás",
    favoriteCategory: "Acessórios",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80"
  },
  {
    id: "C-003",
    name: "Mariana Santos",
    email: "mari.santos@email.com",
    segment: "Novo",
    ltv: "R$ 380,00",
    lastPurchase: "1 semana atrás",
    favoriteCategory: "Jeans",
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=100&h=100&q=80"
  },
  {
    id: "C-004",
    name: "Carolina Oliveira",
    email: "carol.oli@email.com",
    segment: "Em Risco",
    ltv: "R$ 8.500,00",
    lastPurchase: "3 meses atrás",
    favoriteCategory: "Sapatos",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&h=100&q=80"
  },
  {
    id: "C-005",
    name: "Fernanda Lima",
    email: "fe.lima@email.com",
    segment: "VIP",
    ltv: "R$ 22.100,00",
    lastPurchase: "Ontem",
    favoriteCategory: "Casacos",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&h=100&q=80"
  },
];

export default function Customers() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Clienteling</h1>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Cliente
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base font-semibold">Lista de Clientes</CardTitle>
            <div className="flex items-center gap-2">
              <Input 
                placeholder="Buscar por nome, email ou estilo..." 
                className="h-8 w-[250px]" 
              />
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <Filter className="h-3.5 w-3.5" />
                Filtrar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
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
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={customer.image} alt={customer.name} />
                          <AvatarFallback>{customer.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{customer.name}</span>
                          <span className="text-xs text-muted-foreground">{customer.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          customer.segment === "VIP" ? "default" : 
                          customer.segment === "Em Risco" ? "destructive" : 
                          customer.segment === "Novo" ? "secondary" : "outline"
                        }
                        className={customer.segment === "VIP" ? "bg-purple-600 hover:bg-purple-700" : ""}
                      >
                        {customer.segment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Tag className="h-3 w-3" />
                        {customer.favoriteCategory}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{customer.ltv}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{customer.lastPurchase}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
                          <DropdownMenuItem>Criar Pedido</DropdownMenuItem>
                          <DropdownMenuItem>Registrar Interação</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">Arquivar Cliente</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function DropdownMenuSeparator() {
  return <div className="h-px bg-muted my-1" />;
}
