import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowUpRight, 
  Wallet, 
  RotateCcw, 
  Percent, 
  Gift,
  Plus,
  CheckCircle2,
  Settings
} from "lucide-react";
import { useState, useEffect } from "react";
import type { CashbackRule } from "@shared/schema";

export default function Cashback() {
  const [cashbackRules, setCashbackRules] = useState<CashbackRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCashbackRules() {
      try {
        const response = await fetch("/api/cashback-rules");
        if (response.ok) {
          const data = await response.json();
          setCashbackRules(data);
        }
      } catch (error) {
        console.error("Failed to fetch cashback rules:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCashbackRules();
  }, []);

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Cashback & Fidelidade</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas regras de bônus e retenção.</p>
          </div>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto" data-testid="button-new-rule">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Regra de Cashback</span>
            <span className="sm:hidden">Nova Regra</span>
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/80">Cashback Disponível</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold flex items-center gap-1 sm:gap-2" data-testid="text-cashback-available">
                <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">R$ 142.300</span>
                <span className="sm:hidden">R$ 142K</span>
              </div>
              <p className="text-xs text-white/70 mt-1">Passivo pendente</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Resgate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold" data-testid="text-redemption-rate">24.8%</div>
              <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                <ArrowUpRight className="h-3 w-3" />
                +2.1% este mês
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receita Gerada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold" data-testid="text-revenue-generated">
                <span className="hidden sm:inline">R$ 890.120</span>
                <span className="sm:hidden">R$ 890K</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">A partir de resgates</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ROI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold" data-testid="text-roi">12x</div>
              <p className="text-xs text-muted-foreground mt-1">Retorno sobre Investimento</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Regras de Bônus Ativas</CardTitle>
              <CardDescription>Configure como seus clientes ganham cashback.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">Carregando regras...</p>
                </div>
              ) : cashbackRules.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-muted-foreground">Nenhuma regra encontrada.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {cashbackRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0" data-testid={`row-rule-${rule.id}`}>
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                          {rule.value.includes('%') ? <Percent className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-semibold" data-testid={`text-rule-name-${rule.id}`}>{rule.name}</p>
                          <p className="text-sm text-muted-foreground">Gatilho: {rule.trigger} • Expira em {rule.validity}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm font-medium" data-testid={`text-usage-${rule.id}`}>{rule.usage} usos</p>
                          <Badge variant={rule.status === "Ativo" ? "default" : "secondary"} className="mt-1" data-testid={`badge-status-${rule.id}`}>
                            {rule.status}
                          </Badge>
                        </div>
                        <Button variant="ghost" size="icon" data-testid={`button-settings-${rule.id}`}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-emerald-400" />
                Impacto na Retenção
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Taxa de Recompra (com Cashback)</span>
                  <span className="font-bold text-emerald-400">42%</span>
                </div>
                <Progress value={42} className="h-2 bg-slate-800" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Taxa de Recompra (sem bônus)</span>
                  <span className="font-bold text-slate-400">18%</span>
                </div>
                <Progress value={18} className="h-2 bg-slate-800" />
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-indigo-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-indigo-100">Insight</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Saldo de cashback de clientes expira em 5 dias. 
                      <span className="text-indigo-400 cursor-pointer hover:underline ml-1">Enviar lembrete?</span>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
