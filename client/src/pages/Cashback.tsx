import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CashbackRulesTable } from "@/components/cashback/CashbackRulesTable";
import {
  BalanceDistributionWidget,
  ExpiringClientsWidget,
  type CashbackDistributionItem,
  type ExpiringCashbackItem,
} from "@/components/cashback/CashbackWidgets";
import { Wallet, Percent, Plus, Pencil, Loader2, CircleDollarSign, ListChecks } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { capabilities, hasCapability } from "@/lib/capabilities";
import { actionErrorDescription } from "@/lib/actionErrors";
import { summarizeCashbackTransactions } from "@/lib/cashbackMetrics";
import type { CashbackRule, CashbackTransaction } from "@shared/schema";

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

const defaultFormData: CashbackRuleFormData = {
  name: "",
  trigger: "",
  value: "",
  validity: "30",
  status: "Ativo",
};

async function fetchCashbackData<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`Erro ao carregar cashback (${response.status})`);
  return response.json();
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

export default function Cashback() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CashbackRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<CashbackRule | null>(null);
  const [formData, setFormData] = useState<CashbackRuleFormData>(defaultFormData);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const canManageCashback = hasCapability(user, capabilities.manageCashback);

  const { data: cashbackRules = [], isLoading } = useQuery<CashbackRule[]>({
    queryKey: ["cashback-rules"],
    queryFn: async () => {
      const response = await fetch("/api/v1/cashback-rules");
      if (!response.ok) throw new Error("Erro ao carregar regras");
      return response.json();
    },
  });

  const distributionQuery = useQuery<CashbackDistributionItem[]>({
    queryKey: ["cashback", "distribution"],
    queryFn: () => fetchCashbackData("/api/v1/cashback/distribution"),
  });
  const expiringQuery = useQuery<ExpiringCashbackItem[]>({
    queryKey: ["cashback", "expiring", 7],
    queryFn: () => fetchCashbackData("/api/v1/cashback/expiring?days=7"),
  });
  const transactionsQuery = useQuery<CashbackTransaction[]>({
    queryKey: ["cashback", "transactions"],
    queryFn: () => fetchCashbackData("/api/v1/cashback/transactions"),
  });

  const cashbackSummary = summarizeCashbackTransactions(transactionsQuery.data ?? []);
  const activeRules = cashbackRules.filter((rule) => rule.status === "Ativo").length;

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
    onError: (error) => {
      toast({
        title: "Erro ao criar regra",
        description: actionErrorDescription(error, "Não foi possível criar a regra."),
        variant: "destructive",
      });
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
    onError: (error) => {
      toast({
        title: "Erro ao atualizar regra",
        description: actionErrorDescription(error, "Não foi possível atualizar a regra."),
        variant: "destructive",
      });
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
    onError: (error) => {
      toast({
        title: "Erro ao excluir regra",
        description: actionErrorDescription(error, "Não foi possível excluir a regra."),
        variant: "destructive",
      });
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

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Cashback & Fidelidade</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie suas regras de bônus e retenção.
            </p>
          </div>
          {canManageCashback && (
            <Button
              className="gap-2 bg-emerald-700 hover:bg-emerald-800 w-full sm:w-auto"
              onClick={handleOpenCreate}
              data-testid="button-new-rule"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nova Regra de Cashback</span>
              <span className="sm:hidden">Nova Regra</span>
            </Button>
          )}
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none">
            <CardHeader className="pb-2 sm:pb-2">
              <CardTitle className="text-sm font-medium text-white/80">Regras ativas</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 sm:pb-6">
              <div
                className="text-2xl font-bold flex items-center gap-2"
                data-testid="text-cashback-available"
              >
                <ListChecks className="h-5 w-5" />
                <span>{isLoading ? "—" : activeRules}</span>
              </div>
              <p className="text-xs text-white/70 mt-1">
                De {cashbackRules.length} regras configuradas
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 sm:pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total creditado
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 sm:pb-6">
              <div
                className="text-2xl font-bold flex items-center gap-2"
                data-testid="text-total-credited"
              >
                <Wallet className="h-5 w-5" />
                {transactionsQuery.isLoading
                  ? "—"
                  : transactionsQuery.isError
                    ? "Indisponível"
                    : formatCurrency(cashbackSummary.totalCredited)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Somatório do histórico disponível
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 sm:pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total resgatado
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 sm:pb-6">
              <div
                className="text-2xl font-bold flex items-center gap-2"
                data-testid="text-total-redeemed"
              >
                <CircleDollarSign className="h-5 w-5" />
                {transactionsQuery.isLoading
                  ? "—"
                  : transactionsQuery.isError
                    ? "Indisponível"
                    : formatCurrency(cashbackSummary.totalRedeemed)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Débitos registrados no histórico</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 sm:pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Taxa de resgate
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 sm:pb-6">
              <div
                className="text-2xl font-bold flex items-center gap-2"
                data-testid="text-redemption-rate"
              >
                <Percent className="h-5 w-5" />
                {transactionsQuery.isLoading
                  ? "—"
                  : transactionsQuery.isError
                    ? "Indisponível"
                    : `${cashbackSummary.redemptionRate.toFixed(1)}%`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Resgatado sobre o total creditado
              </p>
            </CardContent>
          </Card>
        </div>

        {transactionsQuery.isError && (
          <div
            className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 p-3 text-sm"
            role="alert"
          >
            <span>Não foi possível carregar os indicadores financeiros.</span>
            <Button variant="outline" size="sm" onClick={() => transactionsQuery.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        <CashbackRulesTable
          rules={cashbackRules}
          isLoading={isLoading}
          onEdit={handleOpenEdit}
          onDelete={handleOpenDelete}
          onDuplicate={handleDuplicate}
          onToggleStatus={handleToggleStatus}
          canManage={canManageCashback}
        />

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <BalanceDistributionWidget
              data={distributionQuery.data ?? []}
              isLoading={distributionQuery.isLoading}
              isError={distributionQuery.isError}
              onRetry={() => distributionQuery.refetch()}
            />
          </div>

          <div className="space-y-6">
            <ExpiringClientsWidget
              data={expiringQuery.data ?? []}
              isLoading={expiringQuery.isLoading}
              isError={expiringQuery.isError}
              onRetry={() => expiringQuery.refetch()}
            />
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
              <Label htmlFor="name" className="text-sm font-medium">
                Nome da Regra
              </Label>
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
              <Label htmlFor="value" className="text-sm font-medium">
                Valor do Cashback
              </Label>
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
              <p className="text-xs text-muted-foreground">
                Use % para porcentagem ou R$ para valor fixo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger" className="text-sm font-medium">
                Gatilho
              </Label>
              <Select
                value={formData.trigger}
                onValueChange={(v) => setFormData({ ...formData, trigger: v })}
              >
                <SelectTrigger
                  aria-label="Gatilho da regra"
                  className="w-full h-11"
                  data-testid="select-trigger"
                >
                  <SelectValue placeholder="Selecione quando o cashback é ativado" />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="validity" className="text-sm font-medium">
                Validade
              </Label>
              <Select
                value={formData.validity}
                onValueChange={(v) => setFormData({ ...formData, validity: v })}
              >
                <SelectTrigger
                  aria-label="Validade do cashback"
                  className="w-full h-11"
                  data-testid="select-validity"
                >
                  <SelectValue placeholder="Selecione a validade" />
                </SelectTrigger>
                <SelectContent>
                  {validityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm font-medium">
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger
                  aria-label="Status da regra"
                  className="w-full h-11"
                  data-testid="select-status"
                >
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
            <AlertDialogTitle className="text-base sm:text-lg">
              Excluir Regra de Cashback
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Tem certeza que deseja excluir a regra "{ruleToDelete?.name}"? Esta ação não pode ser
              desfeita.
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
