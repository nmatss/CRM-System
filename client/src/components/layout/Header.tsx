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

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout, isLoggingOut, isSuperAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          data-testid="button-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
      
      <div className="hidden sm:block w-full max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar clientes, campanhas..."
            className="w-full bg-muted/50 border-0 pl-10 focus-visible:ring-cyan-500"
            data-testid="input-search"
          />
        </div>
      </div>
      
      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        {isSuperAdmin && (
          <Badge className="hidden sm:flex items-center gap-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0" data-testid="badge-super-admin">
            <Crown className="w-3 h-3" />
            Super Admin
          </Badge>
        )}
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground hover:bg-muted"
          data-testid="button-theme-toggle"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span className="sr-only">Alternar tema</span>
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground hover:bg-muted relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-[10px] font-bold text-white flex items-center justify-center">
            3
          </span>
          <span className="sr-only">Notificações</span>
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
              <Avatar className="h-9 w-9 border-2 border-cyan-500/30">
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-medium">
                  {user?.name ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium" data-testid="text-user-name">{user?.name}</p>
                <p className="text-xs text-muted-foreground" data-testid="text-user-email">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isSuperAdmin && (
              <DropdownMenuItem onClick={() => setLocation("/admin")} data-testid="menu-item-admin">
                <Crown className="w-4 h-4 mr-2 text-cyan-500" />
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
