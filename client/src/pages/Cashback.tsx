import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowUpRight, 
  Wallet, 
  RotateCcw, 
  Percent, 
  Gift,
  Plus,
  CheckCircle2,
  Settings,
  Trash2,
  Pencil,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { CashbackRule } from "@shared/schema";

interface CashbackRuleFormData {
  name: string;
  trigger: string;
  value: string;
  validity: string;
  status: string;
}

const triggerOptions = [
  { value: "Compra acima de R$ 100", label: "Compra acima de R$ 100" },
  { value: "Compra acima de R$ 200", label: "Compra acima de R$ 200" },
  { value: "Compra acima de R$ 500", label: "Compra acima de R$ 500" },
  { value: "Primeira compra", label: "Primeira compra" },
  { value: "Aniversário do cliente", label: "Aniversário do cliente" },
  { value: "Indicação", label: "Indicação de amigo" },
  { value: "Recompra em 30 dias", label: "Recompra em 30 dias" },
  { value: "Cliente VIP", label: "Cliente VIP" },
  { value: "Qualquer compra", label: "Qualquer compra" },
];

const validityOptions = [
  { value: "7 dias", label: "7 dias" },
  { value: "15 dias", label: "15 dias" },
  { value: "30 dias", label: "30 dias" },
  { value: "60 dias", label: "60 dias" },
  { value: "90 dias", label: "90 dias" },
  { value: "180 dias", label: "180 dias" },
  { value: "1 ano", label: "1 ano" },
  { value: "Sem expiração", label: "Sem expiração" },
];

const defaultFormData: CashbackRuleFormData = {
  name: "",
  trigger: "",
  value: "",
  validity: "30 dias",
  status: "Ativo",
};

export default function Cashback() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CashbackRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<CashbackRule | null>(null);
  const [formData, setFormData] = useState<CashbackRuleFormData>(defaultFormData);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: cashbackRules = [], isLoading } = useQuery<CashbackRule[]>({
    queryKey: ["cashback-rules"],
    queryFn: async () => {
      const response = await fetch("/api/cashback-rules");
      if (!response.ok) throw new Error("Erro ao carregar regras");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CashbackRuleFormData) => {
      const response = await fetch("/api/cashback-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao criar regra");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashback-rules"] });
      toast({ title: "Regra criada com sucesso!" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Erro ao criar regra", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CashbackRuleFormData }) => {
      const response = await fetch(`/api/cashback-rules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao atualizar regra");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashback-rules"] });
      toast({ title: "Regra atualizada com sucesso!" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar regra", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/cashback-rules/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Erro ao excluir regra");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashback-rules"] });
      toast({ title: "Regra excluída com sucesso!" });
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir regra", variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (rule: CashbackRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      trigger: rule.trigger,
      value: rule.value,
      validity: rule.validity,
      status: rule.status,
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
    setFormData(defaultFormData);
  };

  const handleOpenDelete = (rule: CashbackRule) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleConfirmDelete = () => {
    if (ruleToDelete) {
      deleteMutation.mutate(ruleToDelete.id);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Cashback & Fidelidade</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas regras de bônus e retenção.</p>
          </div>
          <Button 
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto" 
            onClick={handleOpenCreate}
            data-testid="button-new-rule"
          >
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
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : cashbackRules.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <p className="text-muted-foreground">Nenhuma regra encontrada.</p>
                  <Button variant="outline" size="sm" onClick={handleOpenCreate} data-testid="button-create-first-rule">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar primeira regra
                  </Button>
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
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-primary">{rule.value}</span> • Gatilho: {rule.trigger} • Expira em {rule.validity}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-medium" data-testid={`text-usage-${rule.id}`}>{rule.usage} usos</p>
                          <Badge variant={rule.status === "Ativo" ? "default" : "secondary"} className="mt-1" data-testid={`badge-status-${rule.id}`}>
                            {rule.status}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleOpenEdit(rule)}
                            data-testid={`button-edit-${rule.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleOpenDelete(rule)}
                            data-testid={`button-delete-${rule.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingRule ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {editingRule ? "Editar Regra de Cashback" : "Nova Regra de Cashback"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da Regra</Label>
              <Input
                id="name"
                placeholder="Ex: Cashback de Boas-vindas"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="input-rule-name"
              />
            </div>

            <div>
              <Label htmlFor="value">Valor do Cashback</Label>
              <Input
                id="value"
                placeholder="Ex: 5% ou R$ 20"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                required
                data-testid="input-rule-value"
              />
              <p className="text-xs text-muted-foreground mt-1">Use % para porcentagem ou R$ para valor fixo</p>
            </div>

            <div>
              <Label htmlFor="trigger">Gatilho</Label>
              <Select 
                value={formData.trigger} 
                onValueChange={(v) => setFormData({ ...formData, trigger: v })}
              >
                <SelectTrigger data-testid="select-trigger">
                  <SelectValue placeholder="Selecione quando o cashback é ativado" />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="validity">Validade</Label>
              <Select 
                value={formData.validity} 
                onValueChange={(v) => setFormData({ ...formData, validity: v })}
              >
                <SelectTrigger data-testid="select-validity">
                  <SelectValue placeholder="Selecione a validade" />
                </SelectTrigger>
                <SelectContent>
                  {validityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Pausado">Pausado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-save-rule">
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingRule ? "Salvar Alterações" : "Criar Regra"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Regra de Cashback</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a regra "{ruleToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
