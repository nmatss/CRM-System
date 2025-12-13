import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Zap, Clock, UserCheck, ShoppingCart, ArrowRight, Gift } from "lucide-react";
import { useState, useEffect } from "react";
import type { Automation } from "@shared/schema";

const iconMap: Record<string, React.ComponentType<any>> = {
  ShoppingCart,
  UserCheck,
  Gift,
  Clock,
  Zap,
};

export default function Automations() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAutomations() {
      try {
        const response = await fetch("/api/automations");
        if (response.ok) {
          const data = await response.json();
          setAutomations(data);
        }
      } catch (error) {
        console.error("Failed to fetch automations:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAutomations();
  }, []);

  const getIconComponent = (iconName: string) => {
    return iconMap[iconName] || Zap;
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Automações</h1>
            <p className="text-muted-foreground">Configure regras de "Se Isso, Então Aquilo" para sua loja.</p>
          </div>
          <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-black" data-testid="button-new-automation">
            <Zap className="h-4 w-4" />
            Nova Automação
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Carregando automações...</p>
          </div>
        ) : automations.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Nenhuma automação encontrada.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {automations.map((automation) => {
              const IconComponent = getIconComponent(automation.icon);
              return (
                <Card key={automation.id} className="relative overflow-hidden border-l-4 border-l-transparent hover:border-l-primary transition-all" data-testid={`card-automation-${automation.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-md">
                        <IconComponent className="h-5 w-5 text-foreground" />
                      </div>
                      <CardTitle className="text-base font-semibold" data-testid={`text-title-${automation.id}`}>{automation.title}</CardTitle>
                    </div>
                    <Switch checked={automation.active === 1} data-testid={`switch-active-${automation.id}`} />
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mt-2 mb-4" data-testid={`text-description-${automation.id}`}>
                      {automation.description}
                    </CardDescription>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground bg-muted/50 px-2 py-1 rounded" data-testid={`text-stats-${automation.id}`}>
                        {automation.stats}
                      </span>
                      <Button variant="ghost" size="sm" className="gap-1 h-8" data-testid={`button-edit-${automation.id}`}>
                        Editar <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
