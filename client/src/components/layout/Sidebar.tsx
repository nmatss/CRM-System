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
  Calendar,
  Crown
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

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
  const [location, setLocation] = useLocation();
  const { logout, isLoggingOut, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Até logo!", description: "Logout realizado com sucesso." });
      setLocation("/login");
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao fazer logout", variant: "destructive" });
    }
  };

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
                data-testid={`nav-link-${item.href.replace("/", "") || "dashboard"}`}
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
                data-testid={`nav-link-${item.href.replace("/", "")}`}
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
          {isSuperAdmin && (
            <Link 
              href="/admin"
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                location === "/admin"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
              data-testid="nav-link-admin"
            >
              <Crown className="h-4 w-4" />
              Painel Admin
            </Link>
          )}
          <Link 
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              location === "/settings"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
            data-testid="nav-link-settings"
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
        </nav>
      </div>

      <div className="border-t p-4">
        <button 
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground disabled:opacity-50"
          data-testid="button-sidebar-logout"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Saindo..." : "Sair"}
        </button>
      </div>
    </div>
  );
}
