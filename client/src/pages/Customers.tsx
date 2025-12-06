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
import { MoreHorizontal, Plus, Filter } from "lucide-react";

const customers = [
  {
    id: "C-001",
    name: "TechVision Inc.",
    contact: "Sarah Miller",
    email: "sarah@techvision.com",
    status: "Active",
    value: "$50,000",
    lastContact: "2 days ago",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=100&h=100&q=80"
  },
  {
    id: "C-002",
    name: "Global Logistics",
    contact: "James Wilson",
    email: "j.wilson@glogistics.com",
    status: "Negotiation",
    value: "$120,000",
    lastContact: "5 hours ago",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&h=100&q=80"
  },
  {
    id: "C-003",
    name: "Creative Studio",
    contact: "Emma Thompson",
    email: "emma@creativestudio.io",
    status: "Active",
    value: "$15,000",
    lastContact: "1 week ago",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&h=100&q=80"
  },
  {
    id: "C-004",
    name: "FinTech Solutions",
    contact: "Michael Chen",
    email: "m.chen@fintech.co",
    status: "Churned",
    value: "$85,000",
    lastContact: "1 month ago",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80"
  },
  {
    id: "C-005",
    name: "Green Energy Corp",
    contact: "David Ross",
    email: "david.r@greenenergy.com",
    status: "Lead",
    value: "$250,000",
    lastContact: "Yesterday",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80"
  },
];

export default function Customers() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base font-semibold">All Customers</CardTitle>
            <div className="flex items-center gap-2">
              <Input 
                placeholder="Search customers..." 
                className="h-8 w-[250px]" 
              />
              <Button variant="outline" size="sm" className="h-8 gap-2">
                <Filter className="h-3.5 w-3.5" />
                Filter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Last Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={customer.image} alt={customer.contact} />
                          <AvatarFallback>{customer.contact.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{customer.name}</span>
                          <span className="text-xs text-muted-foreground">{customer.contact}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          customer.status === "Active" ? "default" : 
                          customer.status === "Churned" ? "destructive" : 
                          customer.status === "Negotiation" ? "secondary" : "outline"
                        }
                      >
                        {customer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{customer.value}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{customer.lastContact}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem>View details</DropdownMenuItem>
                          <DropdownMenuItem>Edit customer</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Delete customer</DropdownMenuItem>
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
