import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  ShoppingBag, 
  Settings, 
  PieChart,
  LogOut,
  Shirt,
  MessageSquare,
  Zap,
  Ticket,
  Calendar
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Agenda do Vendedor", href: "/agenda", icon: Calendar },
  { name: "Clientes (360°)", href: "/customers", icon: Users },
  { name: "Cashback & Fidelidade", href: "/cashback", icon: Ticket },
  { name: "Campanhas", href: "/campaigns", icon: MessageSquare },
  { name: "Automações", href: "/automations", icon: Zap },
  { name: "Pedidos", href: "/orders", icon: ShoppingBag },
  { name: "Produtos", href: "/products", icon: Shirt },
  { name: "Relatórios", href: "/reports", icon: PieChart },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-6">
        <div className="flex items-center gap-2 font-display font-bold text-xl text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            M
          </div>
          Moda CRM
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Crescimento & Retenção
          </div>
          {navigation.slice(0, 6).map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}

          <div className="mt-6 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Operacional
          </div>
          {navigation.slice(6).map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <nav className="mt-8 grid gap-1 px-2">
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Sistema
          </div>
          <Link 
            href="/settings"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
        </nav>
      </div>

      <div className="border-t p-4">
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground">
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
}
