import { Bell, Search, LogOut, Settings, Crown, Menu, Moon, Sun } from "lucide-react";
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
import { useState } from "react";
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

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Até logo!", description: "Logout realizado com sucesso." });
      setLocation("/login");
    } catch (error) {
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
          data-testid="button-menu"
        >
          <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar..."
              className="w-full bg-muted/50 border-0 pl-10 pr-3 h-8 text-sm focus-visible:ring-primary"
              data-testid="input-search-mobile"
              autoFocus
              onBlur={() => setShowMobileSearch(false)}
            />
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => setShowMobileSearch(true)}
          data-testid="button-search-mobile"
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Buscar</span>
        </Button>
      )}

      <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
        {isSuperAdmin && (
          <Badge className="hidden lg:flex items-center gap-1 bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0 text-xs px-2 py-0.5" data-testid="badge-super-admin">
            <Crown className="w-3 h-3" />
            Super Admin
          </Badge>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          data-testid="button-theme-toggle"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
          <span className="sr-only">Alternar tema</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted relative"
              data-testid="button-notifications"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sr-only">Notificações</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 sm:w-80">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Notificações</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma notificação</p>
              <p className="text-xs mt-1">Você está em dia!</p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full" data-testid="button-user-menu">
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
                <p className="text-sm font-medium truncate" data-testid="text-user-name">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isSuperAdmin && (
              <DropdownMenuItem onClick={() => setLocation("/admin")} data-testid="menu-item-admin">
                <Crown className="w-4 h-4 mr-2 text-primary" />
                Painel Admin
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setLocation("/settings")} data-testid="menu-item-settings">
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
