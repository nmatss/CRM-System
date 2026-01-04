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
import { CashbackRulesTable } from "@/components/cashback/CashbackRulesTable";
import { BalanceDistributionWidget, ExpiringClientsWidget, AIInsightsWidget } from "@/components/cashback/CashbackWidgets";
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
  Loader2,
  Sparkles
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
  { value: "180", label: "180 dias" },
  { value: "365", label: "1 ano" },
  { value: "0", label: "Sem expiração" },
];

const getValidityLabel = (days: number): string => {
  const option = validityOptions.find(opt => opt.value === String(days));
  return option ? option.label : `${days} dias`;
};

const defaultFormData: CashbackRuleFormData = {
  name: "",
  trigger: "",
  value: "",
  validity: "30",
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
      const response = await fetch("/api/v1/cashback-rules");
      if (!response.ok) throw new Error("Erro ao carregar regras");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CashbackRuleFormData) => {
      const response = await apiRequest("POST", "/cashback-rules", data);
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
      const response = await apiRequest("PUT", `/cashback-rules/${id}`, data);
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
      const response = await apiRequest("DELETE", `/cashback-rules/${id}`);
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
      value: String(rule.value || 0),
      validity: String(rule.validity),
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
    const dataToSubmit = {
      name: formData.name,
      trigger: formData.trigger,
      value: formData.value,
      validity: parseInt(formData.validity) || 30,
      status: formData.status,
    };
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: dataToSubmit as any });
    } else {
      createMutation.mutate(dataToSubmit as any);
    }
  };

  const handleConfirmDelete = () => {
    if (ruleToDelete) {
      deleteMutation.mutate(ruleToDelete.id);
    }
  };

  const handleDuplicate = (rule: CashbackRule) => {
    setEditingRule(null);
    setFormData({
      name: `${rule.name} (Cópia)`,
      trigger: rule.trigger,
      value: String(rule.value || 0),
      validity: String(rule.validity),
      status: "Inativo",
    });
    setDialogOpen(true);
  };

  const handleToggleStatus = (rule: CashbackRule) => {
    const newStatus = rule.status === "Ativo" ? "Pausado" : "Ativo";
    updateMutation.mutate({
      id: rule.id,
      data: {
        name: rule.name,
        trigger: rule.trigger,
        value: String(rule.value),
        validity: rule.validity,
        status: newStatus,
      } as any,
    });
  };

  const handleSendReminder = (clientId: number) => {
    toast({
      title: "Lembrete enviado!",
      description: "O cliente receberá um lembrete sobre o cashback expirando.",
    });
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

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none">
            <CardHeader className="pb-2 sm:pb-2">
              <CardTitle className="text-sm font-medium text-white/80">Cashback Disponível</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 sm:pb-6">
              <div className="text-2xl font-bold flex items-center gap-2" data-testid="text-cashback-available">
                <Wallet className="h-5 w-5" />
                <span>R$ 142.300</span>
              </div>
              <p className="text-xs text-white/70 mt-1">Passivo pendente</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 sm:pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Resgate</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 sm:pb-6">
              <div className="text-2xl font-bold" data-testid="text-redemption-rate">24.8%</div>
              <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                <ArrowUpRight className="h-3 w-3" />
                +2.1% este mês
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 sm:pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receita Gerada</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 sm:pb-6">
              <div className="text-2xl font-bold" data-testid="text-revenue-generated">
                R$ 890.120
              </div>
              <p className="text-xs text-muted-foreground mt-1">A partir de resgates</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 sm:pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ROI</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 sm:pb-6">
              <div className="text-2xl font-bold" data-testid="text-roi">12x</div>
              <p className="text-xs text-muted-foreground mt-1">Retorno sobre Investimento</p>
            </CardContent>
          </Card>
        </div>

        <CashbackRulesTable
          rules={cashbackRules}
          isLoading={isLoading}
          onEdit={handleOpenEdit}
          onDelete={handleOpenDelete}
          onDuplicate={handleDuplicate}
          onToggleStatus={handleToggleStatus}
        />

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <BalanceDistributionWidget />
            <AIInsightsWidget />
          </div>

          <div className="space-y-6">
            <ExpiringClientsWidget onSendReminder={handleSendReminder} />

            <Card className="bg-slate-900 text-white border-slate-800">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <RotateCcw className="h-5 w-5 text-emerald-400" />
                  Impacto na Retenção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center gap-2 text-sm">
                    <span className="text-slate-400 text-xs sm:text-sm">Taxa de Recompra (com Cashback)</span>
                    <span className="font-bold text-emerald-400">42%</span>
                  </div>
                  <Progress value={42} className="h-2 bg-slate-800" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center gap-2 text-sm">
                    <span className="text-slate-400 text-xs sm:text-sm">Taxa de Recompra (sem bônus)</span>
                    <span className="font-bold text-slate-400">18%</span>
                  </div>
                  <Progress value={18} className="h-2 bg-slate-800" />
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-indigo-100 text-sm">Insight</p>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Clientes com cashback têm 133% mais chance de recompra nos próximos 30 dias.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {editingRule ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {editingRule ? "Editar Regra de Cashback" : "Nova Regra de Cashback"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Nome da Regra</Label>
              <Input
                id="name"
                placeholder="Ex: Cashback de Boas-vindas"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full h-11 text-base"
                data-testid="input-rule-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="value" className="text-sm font-medium">Valor do Cashback</Label>
              <Input
                id="value"
                type="text"
                inputMode="decimal"
                placeholder="Ex: 5% ou R$ 20"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                required
                className="w-full h-11 text-base"
                data-testid="input-rule-value"
              />
              <p className="text-xs text-muted-foreground">Use % para porcentagem ou R$ para valor fixo</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger" className="text-sm font-medium">Gatilho</Label>
              <Select
                value={formData.trigger}
                onValueChange={(v) => setFormData({ ...formData, trigger: v })}
              >
                <SelectTrigger className="w-full h-11" data-testid="select-trigger">
                  <SelectValue placeholder="Selecione quando o cashback é ativado" />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="validity" className="text-sm font-medium">Validade</Label>
              <Select
                value={formData.validity}
                onValueChange={(v) => setFormData({ ...formData, validity: v })}
              >
                <SelectTrigger className="w-full h-11" data-testid="select-validity">
                  <SelectValue placeholder="Selecione a validade" />
                </SelectTrigger>
                <SelectContent>
                  {validityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm font-medium">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger className="w-full h-11" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Pausado">Pausado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                className="w-full sm:w-auto order-2 sm:order-1"
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto order-1 sm:order-2"
                data-testid="button-save-rule"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingRule ? "Salvar Alterações" : "Criar Regra"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Excluir Regra de Cashback</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Tem certeza que deseja excluir a regra "{ruleToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
            <AlertDialogCancel
              className="w-full sm:w-auto order-2 sm:order-1 mt-0"
              data-testid="button-cancel-delete"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="w-full sm:w-auto order-1 sm:order-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
