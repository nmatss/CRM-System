import { useEffect, useRef, useState } from "react";
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
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { capabilities, hasCapability, type Capability } from "@/lib/capabilities";
import zippiLogo from "@assets/generated_images/zippi_crm_modern_logo.png";

const navigation: Array<{
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  capability: Capability;
}> = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    capability: capabilities.viewDashboard,
  },
  {
    name: "Agenda do Vendedor",
    href: "/agenda",
    icon: Calendar,
    capability: capabilities.viewSellerAgenda,
  },
  {
    name: "Clientes (360°)",
    href: "/customers",
    icon: Users,
    capability: capabilities.viewCustomers,
  },
  {
    name: "Cashback & Fidelidade",
    href: "/cashback",
    icon: Ticket,
    capability: capabilities.viewCashback,
  },
  {
    name: "Campanhas",
    href: "/campaigns",
    icon: MessageSquare,
    capability: capabilities.viewCampaigns,
  },
  { name: "Automações", href: "/automations", icon: Zap, capability: capabilities.viewAutomations },
  { name: "Pedidos", href: "/orders", icon: ShoppingBag, capability: capabilities.viewOrders },
  { name: "Produtos", href: "/products", icon: Shirt, capability: capabilities.viewProducts },
  { name: "Relatórios", href: "/reports", icon: PieChart, capability: capabilities.viewReports },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const can = (capability: Capability) => hasCapability(user, capability);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const updateIsDesktop = () => setIsDesktop(desktopQuery.matches);

    updateIsDesktop();
    desktopQuery.addEventListener("change", updateIsDesktop);
    return () => desktopQuery.removeEventListener("change", updateIsDesktop);
  }, []);

  useEffect(() => {
    if (!isOpen || isDesktop || !onClose) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements.at(-1);

      if (!firstFocusable || !lastFocusable) {
        event.preventDefault();
      } else if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [isDesktop, isOpen, onClose]);

  const isSidebarVisible = isDesktop || isOpen;

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Até logo!", description: "Logout realizado com sucesso." });
      setLocation("/login");
    } catch {
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
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-label="Fechar menu principal"
        />
      )}

      <aside
        ref={panelRef}
        aria-label="Menu principal"
        aria-hidden={!isSidebarVisible}
        aria-modal={!isDesktop && isOpen ? true : undefined}
        role={!isDesktop && isOpen ? "dialog" : undefined}
        inert={!isSidebarVisible ? true : undefined}
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 flex h-screen w-full max-w-xs sm:w-64 lg:shrink-0 flex-col bg-[#050A1A] text-white transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
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
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Fechar menu principal"
              className="lg:hidden p-1.5 sm:p-2 rounded-lg hover:bg-white/10 transition-colors"
              data-testid="button-close-sidebar"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="grid gap-1 px-3" aria-label="Crescimento, retenção e operação">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              Crescimento & Retenção
            </div>
            {navigation
              .slice(0, 6)
              .filter((item) => can(item.capability))
              .map((item) => {
                const isActive =
                  location === item.href || (item.href === "/dashboard" && location === "/");
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={handleLinkClick}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                      isActive
                        ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border-l-2 border-cyan-400"
                        : "text-gray-400 hover:bg-white/5 hover:text-white",
                    )}
                    data-testid={`nav-link-${item.href.replace("/", "") || "dashboard"}`}
                  >
                    <item.icon
                      className={cn("h-4 w-4", isActive && "text-cyan-400")}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}

            <div className="mt-6 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-blue-300">
              Operacional
            </div>
            {navigation
              .slice(6)
              .filter((item) => can(item.capability))
              .map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={handleLinkClick}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                      isActive
                        ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border-l-2 border-cyan-400"
                        : "text-gray-400 hover:bg-white/5 hover:text-white",
                    )}
                    data-testid={`nav-link-${item.href.replace("/", "")}`}
                  >
                    <item.icon
                      className={cn("h-4 w-4", isActive && "text-cyan-400")}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                );
              })}
          </nav>

          <nav className="mt-8 grid gap-1 px-3" aria-label="Sistema">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-purple-300">
              Sistema
            </div>
            {can(capabilities.viewAdmin) && (
              <Link
                href="/admin"
                onClick={handleLinkClick}
                aria-current={location === "/admin" ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  location === "/admin"
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border-l-2 border-cyan-400"
                    : "text-gray-400 hover:bg-white/5 hover:text-white",
                )}
                data-testid="nav-link-admin"
              >
                <Crown
                  className={cn("h-4 w-4", location === "/admin" && "text-cyan-400")}
                  aria-hidden="true"
                />
                Painel Admin
              </Link>
            )}
            {can(capabilities.viewSettings) && (
              <Link
                href="/settings"
                onClick={handleLinkClick}
                aria-current={location === "/settings" ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  location === "/settings"
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-400 border-l-2 border-cyan-400"
                    : "text-gray-400 hover:bg-white/5 hover:text-white",
                )}
                data-testid="nav-link-settings"
              >
                <Settings
                  className={cn("h-4 w-4", location === "/settings" && "text-cyan-400")}
                  aria-hidden="true"
                />
                Configurações
              </Link>
            )}
          </nav>
        </div>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
            data-testid="button-sidebar-logout"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {isLoggingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </aside>
    </>
  );
}
