import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  PieChart,
  LogOut,
  Crown,
  X,
  BarChart3,
  FileText
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import zippiLogo from "@assets/generated_images/zippi_crm_modern_logo.png";
import { Header } from "./Header";

const adminNavigation = [
  { name: "Dashboard", tab: "dashboard", icon: LayoutDashboard },
  { name: "Empresas", tab: "empresas", icon: Building2 },
  { name: "Usuários", tab: "usuarios", icon: Users },
  { name: "Relatórios Gerais", tab: "relatorios", icon: BarChart3 },
  { name: "Contatos", tab: "contatos", icon: FileText },
  { name: "Demos", tab: "demos", icon: PieChart },
];

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

function AdminSidebar({ isOpen = true, onClose, activeTab = "dashboard", onTabChange }: AdminSidebarProps) {
  const [location, setLocation] = useLocation();
  const { logout, isLoggingOut } = useAuth();
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

  const handleNavClick = (tab: string) => {
    if (onTabChange) {
      onTabChange(tab);
    }
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
        "fixed lg:static inset-y-0 left-0 z-50 flex h-screen w-64 flex-col bg-[#050A1A] text-white transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-2">
            <img 
              src={zippiLogo} 
              alt="Zippi CRM" 
              className="h-10 w-auto object-contain"
              data-testid="sidebar-logo"
            />
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              data-testid="button-close-sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="grid gap-1 px-3">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-yellow-400/70 flex items-center gap-2">
              <Crown className="h-3 w-3" />
              Painel Super Admin
            </div>
            {adminNavigation.map((item) => {
              const isActive = activeTab === item.tab;
              return (
                <button 
                  key={item.name} 
                  onClick={() => handleNavClick(item.tab)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all w-full text-left",
                    isActive
                      ? "bg-gradient-to-r from-yellow-500/20 to-orange-600/20 text-yellow-400 border-l-2 border-yellow-400"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                  data-testid={`admin-nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className={cn("h-4 w-4", isActive && "text-yellow-400")} />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3 px-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-orange-600">
              <Crown className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium">Super Admin</p>
              <p className="text-xs text-gray-400">Acesso Total</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-red-400 transition-all disabled:opacity-50"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </div>
    </>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function AdminLayout({ children, activeTab = "dashboard", onTabChange }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
      <div className="flex flex-1 flex-col overflow-hidden lg:ml-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
