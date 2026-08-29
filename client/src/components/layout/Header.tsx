import {
  AlertCircle,
  Bell,
  Search,
  LogOut,
  Settings,
  Crown,
  Loader2,
  Menu,
  Moon,
  RefreshCw,
  Sun,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  countUnreadNotifications,
  formatNotificationDate,
  parseNotificationsResponse,
  type HeaderNotification,
} from "@/lib/notifications";
import zippiLogo from "@assets/generated_images/zippi_crm_modern_logo.png";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout, isLoggingOut, isSuperAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const mobileSearchButtonRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreSearchFocusRef = useRef(false);
  const {
    data: notifications = [],
    isLoading: areNotificationsLoading,
    isError: hasNotificationsError,
    refetch: refetchNotifications,
  } = useQuery<HeaderNotification[]>({
    queryKey: ["notifications", user?.tenantId, 50],
    queryFn: async () => {
      const response = await apiRequest("GET", "/notifications?limit=50");
      return parseNotificationsResponse(await response.json());
    },
    enabled: Boolean(user?.tenantId),
    staleTime: 60_000,
  });
  const unreadNotifications = countUnreadNotifications(notifications);

  useEffect(() => {
    if (!showMobileSearch && shouldRestoreSearchFocusRef.current) {
      mobileSearchButtonRef.current?.focus();
      shouldRestoreSearchFocusRef.current = false;
    }
  }, [showMobileSearch]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Até logo!", description: "Logout realizado com sucesso." });
      setLocation("/login");
    } catch {
      toast({ title: "Erro", description: "Falha ao fazer logout", variant: "destructive" });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 sm:px-4 lg:px-6">
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8 sm:h-9 sm:w-9 shrink-0"
          onClick={onMenuClick}
          aria-label="Abrir menu principal"
          data-testid="button-menu"
        >
          <Menu className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
        </Button>
      )}

      {/* Logo - visible on mobile only */}
      <div className="lg:hidden shrink-0">
        <img
          src={zippiLogo}
          alt="Zippi CRM"
          className="h-7 sm:h-8 w-auto object-contain"
          data-testid="header-logo"
        />
      </div>

      {/* Desktop search */}
      <div className="hidden md:block w-full max-w-md">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Buscar clientes e campanhas"
            placeholder="Buscar clientes, campanhas..."
            className="w-full bg-muted/50 border-0 pl-10 focus-visible:ring-primary"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* Mobile search - expandable */}
      {showMobileSearch ? (
        <div className="md:hidden flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Buscar clientes e campanhas"
              placeholder="Buscar..."
              className="w-full bg-muted/50 border-0 pl-10 pr-3 h-8 text-sm focus-visible:ring-primary"
              data-testid="input-search-mobile"
              autoFocus
              onBlur={() => setShowMobileSearch(false)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  shouldRestoreSearchFocusRef.current = true;
                  setShowMobileSearch(false);
                }
              }}
            />
          </div>
        </div>
      ) : (
        <Button
          ref={mobileSearchButtonRef}
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => setShowMobileSearch(true)}
          aria-label="Abrir busca"
          data-testid="button-search-mobile"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}

      <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
        {isSuperAdmin && (
          <Badge
            className="hidden lg:flex items-center gap-1 bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0 text-xs px-2 py-0.5"
            data-testid="badge-super-admin"
          >
            <Crown className="w-3 h-3" />
            Super Admin
          </Badge>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
          className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          data-testid="button-theme-toggle"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted relative"
              aria-label={
                unreadNotifications > 0
                  ? `Notificações: ${unreadNotifications} não lidas entre as mais recentes`
                  : "Notificações"
              }
              data-testid="button-notifications"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              {unreadNotifications > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
                  aria-hidden="true"
                  data-testid="badge-notifications"
                >
                  {unreadNotifications}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 sm:w-80">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Notificações</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {areNotificationsLoading ? (
              <div
                className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
                role="status"
                data-testid="notifications-loading"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando notificações...
              </div>
            ) : hasNotificationsError ? (
              <div className="px-4 py-5 text-center text-sm" data-testid="notifications-error">
                <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
                <p className="font-medium">Não foi possível carregar as notificações.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => refetchNotifications()}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Tentar novamente
                </Button>
              </div>
            ) : notifications.length === 0 ? (
              <div
                className="py-6 text-center text-sm text-muted-foreground"
                data-testid="notifications-empty"
              >
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma notificação</p>
                <p className="text-xs mt-1">Você está em dia!</p>
              </div>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1" data-testid="notifications-list">
                {notifications.map((notification) => {
                  const isUnread = notification.status.toLowerCase() !== "read";

                  return (
                    <li
                      key={notification.id}
                      className="border-b border-border/60 px-3 py-3 last:border-b-0"
                    >
                      <div className="flex gap-2.5">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            isUnread ? "bg-primary" : "bg-muted-foreground/30"
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>
                            {notification.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatNotificationDate(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full"
              aria-label={user?.name ? `Abrir menu de ${user.name}` : "Abrir menu do usuário"}
              data-testid="button-user-menu"
            >
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border-2 border-primary/30">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-cyan-500 text-white text-xs sm:text-sm font-medium">
                  {user?.name ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium truncate" data-testid="text-user-name">
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isSuperAdmin && (
              <DropdownMenuItem onClick={() => setLocation("/admin")} data-testid="menu-item-admin">
                <Crown className="w-4 h-4 mr-2 text-primary" />
                Painel Admin
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => setLocation("/settings")}
              data-testid="menu-item-settings"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-destructive focus:text-destructive"
              data-testid="menu-item-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {isLoggingOut ? "Saindo..." : "Sair"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
