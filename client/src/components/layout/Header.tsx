import { Bell, Search, LogOut, Settings, Crown, Store } from "lucide-react";
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

export function Header() {
  const { user, logout, isLoggingOut, isSuperAdmin } = useAuth();
  const [, setLocation] = useLocation();
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-6 shadow-sm">
      <div className="w-full max-w-md">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar clientes, campanhas..."
            className="w-full bg-background pl-9 md:w-[300px] lg:w-[400px]"
            data-testid="input-search"
          />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-4">
        {isSuperAdmin && (
          <Badge variant="secondary" className="flex items-center gap-1" data-testid="badge-super-admin">
            <Crown className="w-3 h-3" />
            Super Admin
          </Badge>
        )}
        
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" data-testid="button-notifications">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notificações</span>
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="button-user-menu">
              <Avatar className="h-8 w-8 border">
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-pink-600 text-white text-xs">
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
                <Crown className="w-4 h-4 mr-2" />
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
