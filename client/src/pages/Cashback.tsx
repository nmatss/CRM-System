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
  Clock,
  CheckCircle2
} from "lucide-react";

const cashbackRules = [
  {
    id: 1,
    name: "Welcome Bonus",
    trigger: "First Purchase",
    value: "15%",
    validity: "30 days",
    status: "Active",
    usage: 1250
  },
  {
    id: 2,
    name: "Birthday Special",
    trigger: "Birthday Month",
    value: "R$ 50,00",
    validity: "Month end",
    status: "Active",
    usage: 450
  },
  {
    id: 3,
    name: "Winback Inactive",
    trigger: "90 days inactive",
    value: "20%",
    validity: "15 days",
    status: "Paused",
    usage: 89
  }
];

export default function Cashback() {
  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cashback & Loyalty</h1>
            <p className="text-muted-foreground">Manage your retention engine and bonus rules.</p>
          </div>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4" />
            New Cashback Rule
          </Button>
        </div>

        {/* Hero Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/80">Available Cashback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                R$ 142.300
              </div>
              <p className="text-xs text-white/70 mt-1">Outstanding liability</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Redemption Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24.8%</div>
              <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                <ArrowUpRight className="h-3 w-3" />
                +2.1% this month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Generated Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 890.120</div>
              <p className="text-xs text-muted-foreground mt-1">From cashback redemption</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ROI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12x</div>
              <p className="text-xs text-muted-foreground mt-1">Return on Bonus Investment</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Active Campaigns */}
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Active Bonus Rules</CardTitle>
              <CardDescription>Configure how your customers earn cashback.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {cashbackRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {rule.value.includes('%') ? <Percent className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-semibold">{rule.name}</p>
                        <p className="text-sm text-muted-foreground">Trigger: {rule.trigger} • Expires in {rule.validity}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-medium">{rule.usage} uses</p>
                        <Badge variant={rule.status === "Active" ? "default" : "secondary"} className="mt-1">
                          {rule.status}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Widget */}
          <Card className="bg-slate-900 text-white border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-emerald-400" />
                Retention Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Repurchase Rate (with Cashback)</span>
                  <span className="font-bold text-emerald-400">42%</span>
                </div>
                <Progress value={42} className="h-2 bg-slate-800" indicatorClassName="bg-emerald-500" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Repurchase Rate (without)</span>
                  <span className="font-bold text-slate-400">18%</span>
                </div>
                <Progress value={18} className="h-2 bg-slate-800" indicatorClassName="bg-slate-600" />
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-indigo-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-indigo-100">Insight</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Customers with cashback balance expire in 5 days. 
                      <span className="text-indigo-400 cursor-pointer hover:underline ml-1">Send reminder?</span>
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
