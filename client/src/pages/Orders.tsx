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
  Download,
  AlertCircle
} from "lucide-react";

const orders = [
  {
    id: "#ORD-7829",
    customer: "Ana Silva",
    date: "Hoje, 14:30",
    total: "R$ 299,00",
    status: "Pago",
    items: 2,
    method: "Cartão de Crédito"
  },
  {
    id: "#ORD-7828",
    customer: "Juliana Costa",
    date: "Hoje, 11:15",
    total: "R$ 450,00",
    status: "Processando",
    items: 1,
    method: "PIX"
  },
  {
    id: "#ORD-7827",
    customer: "Carlos Eduardo",
    date: "Ontem, 18:45",
    total: "R$ 1.250,00",
    status: "Enviado",
    items: 4,
    method: "Cartão de Crédito"
  },
  {
    id: "#ORD-7826",
    customer: "Mariana Santos",
    date: "Ontem, 16:20",
    total: "R$ 380,00",
    status: "Entregue",
    items: 1,
    method: "PIX"
  },
  {
    id: "#ORD-7825",
    customer: "Roberto Almeida",
    date: "04 Dez, 09:10",
    total: "R$ 89,90",
    status: "Cancelado",
    items: 1,
    method: "Boleto"
  }
];

export default function Orders() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
            <p className="text-muted-foreground">Gerencie e processe os pedidos da loja.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Novo Pedido
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Input 
            placeholder="Buscar pedido, cliente ou valor..." 
            className="max-w-sm" 
          />
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
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
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell>{order.date}</TableCell>
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
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.total}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{order.method}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
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
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
