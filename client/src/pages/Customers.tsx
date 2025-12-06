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
import { useState, useEffect } from "react";
import type { Customer } from "@shared/schema";

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const response = await fetch("/api/customers");
        if (response.ok) {
          const data = await response.json();
          setCustomers(data);
        }
      } catch (error) {
        console.error("Failed to fetch customers:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, []);
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
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Carregando clientes...</p>
              </div>
            ) : customers.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
              </div>
            ) : (
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
                    <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={customer.image || undefined} alt={customer.name} />
                            <AvatarFallback>{customer.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium" data-testid={`text-customer-name-${customer.id}`}>{customer.name}</span>
                            <span className="text-xs text-muted-foreground" data-testid={`text-customer-email-${customer.id}`}>{customer.email}</span>
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
                      <TableCell className="font-medium" data-testid={`text-ltv-${customer.id}`}>{customer.ltv}</TableCell>
                      <TableCell className="text-muted-foreground text-sm" data-testid={`text-last-purchase-${customer.id}`}>{customer.lastPurchase}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${customer.id}`}>
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
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function DropdownMenuSeparator() {
  return <div className="h-px bg-muted my-1" />;
}
