import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import Cashback from "@/pages/Cashback";
import Campaigns from "@/pages/Campaigns";
import Automations from "@/pages/Automations";
import Orders from "@/pages/Orders";
import Products from "@/pages/Products";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard}/>
      <Route path="/customers" component={Customers}/>
      <Route path="/cashback" component={Cashback}/>
      <Route path="/campaigns" component={Campaigns}/>
      <Route path="/automations" component={Automations}/>
      <Route path="/orders" component={Orders}/>
      <Route path="/products" component={Products}/>
      <Route path="/reports" component={Reports}/>
      <Route path="/settings" component={Settings}/>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
