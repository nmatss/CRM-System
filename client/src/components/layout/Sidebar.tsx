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
  Crown,
  X
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import zippiLogo from "@assets/generated_images/zippi_crm_modern_logo.png";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Agenda do Vendedor", href: "/agenda", icon: Calendar },
  { name: "Clientes (360°)", href: "/customers", icon: Users },
  { name: "Cashback & Fidelidade", href: "/cashback", icon: Ticket },
  { name: "Campanhas", href: "/campaigns", icon: MessageSquare },
  { name: "Automações", href: "/automations", icon: Zap },
  { name: "Pedidos", href: "/orders", icon: ShoppingBag },
  { name: "Produtos", href: "/products", icon: Shirt },
  { name: "Relatórios", href: "/reports", icon: PieChart },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
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

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {isOpen && onClose && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 flex h-screen w-full max-w-xs sm:w-64 flex-col bg-[#050A1A] text-white transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-14 sm:h-16 items-center justify-between border-b border-white/10 px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <img
              src={zippiLogo}
              alt="Zippi CRM"
              className="h-7 sm:h-9 lg:h-10 w-auto object-contain"
              data-testid="sidebar-logo"
            />
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors"
              data-testid="button-close-sidebar"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="grid gap-1 px-3">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-cyan-400/70">
              Crescimento & Retenção
            </div>
            {navigation.slice(0, 6).map((item) => {
              const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  onClick={handleLinkClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border-l-2 border-cyan-400"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                  data-testid={`nav-link-${item.href.replace("/", "") || "dashboard"}`}
                >
                  <item.icon className={cn("h-4 w-4", isActive && "text-cyan-400")} />
                  {item.name}
                </Link>
              );
            })}

            <div className="mt-6 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-blue-400/70">
              Operacional
            </div>
            {navigation.slice(6).map((item) => {
              const isActive = location === item.href;
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  onClick={handleLinkClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border-l-2 border-cyan-400"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                  data-testid={`nav-link-${item.href.replace("/", "")}`}
                >
                  <item.icon className={cn("h-4 w-4", isActive && "text-cyan-400")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          <nav className="mt-8 grid gap-1 px-3">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-purple-400/70">
              Sistema
            </div>
            {isSuperAdmin && (
              <Link 
                href="/admin"
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  location === "/admin"
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border-l-2 border-cyan-400"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                )}
                data-testid="nav-link-admin"
              >
                <Crown className={cn("h-4 w-4", location === "/admin" && "text-cyan-400")} />
                Painel Admin
              </Link>
            )}
            <Link 
              href="/settings"
              onClick={handleLinkClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                location === "/settings"
                  ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border-l-2 border-cyan-400"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
              data-testid="nav-link-settings"
            >
              <Settings className={cn("h-4 w-4", location === "/settings" && "text-cyan-400")} />
              Configurações
            </Link>
          </nav>
        </div>

        <div className="border-t border-white/10 p-4">
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
            data-testid="button-sidebar-logout"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </div>
    </>
  );
}
