import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense, useState, type FormEvent } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/use-auth";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Lazy loads - code splitting for route-level pages
const Login = lazy(() => import("@/pages/Login"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const Landing = lazy(() => import("@/pages/Landing"));
const TenantLogin = lazy(() => import("@/pages/TenantLogin"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Admin = lazy(() => import("@/pages/Admin"));
const Customers = lazy(() => import("@/pages/Customers"));
const AgendaVendedor = lazy(() => import("@/pages/AgendaVendedor"));
const Cashback = lazy(() => import("@/pages/Cashback"));
const Campaigns = lazy(() => import("@/pages/Campaigns"));
const Automations = lazy(() => import("@/pages/Automations"));
const Orders = lazy(() => import("@/pages/Orders"));
const Products = lazy(() => import("@/pages/Products"));
const Reports = lazy(() => import("@/pages/Reports"));
const Settings = lazy(() => import("@/pages/Settings"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Loading spinner component for Suspense fallback
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function PasswordChangeGate() {
  const { changePassword, logout, isChangingPassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 12) {
      setError("A nova senha deve ter pelo menos 12 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Troca de senha obrigatória</CardTitle>
          <CardDescription>
            Altere sua senha inicial para continuar usando o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={12}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={12}
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => logout()}>
                Sair
              </Button>
              <Button type="submit" className="flex-1" disabled={isChangingPassword}>
                {isChangingPassword ? "Alterando..." : "Alterar senha"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading, isSuperAdmin, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Super Admin should go to /admin, regular users to /dashboard
  const defaultAuthRoute = isSuperAdmin ? "/admin" : "/dashboard";

  if (isAuthenticated && user?.mustChangePassword) {
    return <PasswordChangeGate />;
  }

  return (
    <Switch>
      <Route path="/">{isAuthenticated ? <Redirect to={defaultAuthRoute} /> : <Landing />}</Route>
      <Route path="/landing">
        <Landing />
      </Route>
      <Route path="/login">
        {isAuthenticated ? <Redirect to={defaultAuthRoute} /> : <Login />}
      </Route>
      <Route path="/loja/:slug">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <TenantLogin />}
      </Route>
      <Route path="/zippi-sistema-x7k9">
        {isAuthenticated ? <Redirect to="/admin" /> : <AdminLogin />}
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={Admin} />
      </Route>
      <Route path="/customers">
        <ProtectedRoute component={Customers} />
      </Route>
      <Route path="/agenda">
        <ProtectedRoute component={AgendaVendedor} />
      </Route>
      <Route path="/cashback">
        <ProtectedRoute component={Cashback} />
      </Route>
      <Route path="/campaigns">
        <ProtectedRoute component={Campaigns} />
      </Route>
      <Route path="/automations">
        <ProtectedRoute component={Automations} />
      </Route>
      <Route path="/orders">
        <ProtectedRoute component={Orders} />
      </Route>
      <Route path="/products">
        <ProtectedRoute component={Products} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={Reports} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Router />
            </Suspense>
          </ErrorBoundary>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
