import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import ErrorBoundary from "@/components/ErrorBoundary";

// Eager loads - needed immediately for initial navigation
import Login from "@/pages/Login";
import AdminLogin from "@/pages/AdminLogin";
import Landing from "@/pages/Landing";
import TenantLogin from "@/pages/TenantLogin";

// Lazy loads - code splitting for major pages
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

function Router() {
  const { isAuthenticated, isLoading, isSuperAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Super Admin should go to /admin, regular users to /dashboard
  const defaultAuthRoute = isSuperAdmin ? "/admin" : "/dashboard";

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <Redirect to={defaultAuthRoute} /> : <Landing />}
      </Route>
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
