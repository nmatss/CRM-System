import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Zap, 
  Clock, 
  UserCheck, 
  ShoppingCart, 
  ArrowRight, 
  Gift,
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Mail,
  MessageSquare,
  AlertCircle,
  Calendar
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Automation } from "@shared/schema";

const iconMap: Record<string, React.ComponentType<any>> = {
  ShoppingCart,
  UserCheck,
  Gift,
  Clock,
  Zap,
  Mail,
  MessageSquare,
  AlertCircle,
  Calendar,
};

const iconOptions = [
  { value: "ShoppingCart", label: "Carrinho", icon: ShoppingCart },
  { value: "UserCheck", label: "Cliente", icon: UserCheck },
  { value: "Gift", label: "Presente", icon: Gift },
  { value: "Clock", label: "Tempo", icon: Clock },
  { value: "Zap", label: "Automação", icon: Zap },
  { value: "Mail", label: "Email", icon: Mail },
  { value: "MessageSquare", label: "Mensagem", icon: MessageSquare },
  { value: "Calendar", label: "Calendário", icon: Calendar },
];

const triggerTemplates = [
  {
    name: "Primeira compra",
    trigger: "Quando cliente fizer a primeira compra",
    action: "Enviar WhatsApp de boas-vindas com cupom 10% OFF",
    icon: "ShoppingCart",
  },
  {
    name: "Aniversário",
    trigger: "1 dia antes do aniversário do cliente",
    action: "Enviar WhatsApp de parabéns com cupom 20% OFF",
    icon: "Gift",
  },
  {
    name: "Cliente inativo",
    trigger: "Cliente sem compras há 60 dias",
    action: "Enviar SMS com oferta de reativação 15% OFF",
    icon: "Clock",
  },
  {
    name: "Novo VIP",
    trigger: "Cliente atinge status VIP",
    action: "Enviar email de boas-vindas ao programa VIP",
    icon: "UserCheck",
  },
  {
    name: "Lembrete de carrinho",
    trigger: "Carrinho abandonado há 24 horas",
    action: "Enviar WhatsApp lembrando dos itens",
    icon: "AlertCircle",
  },
];

interface AutomationFormData {
  title: string;
  description: string;
  icon: string;
  isActive: boolean;
  stats: string;
}

const initialFormData: AutomationFormData = {
  title: "",
  description: "",
  icon: "Zap",
  isActive: true,
  stats: "0 execuções",
};

export default function Automations() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [automationToDelete, setAutomationToDelete] = useState<Automation | null>(null);
  const [formData, setFormData] = useState<AutomationFormData>(initialFormData);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: automations = [], isLoading } = useQuery<Automation[]>({
    queryKey: ["automations"],
    queryFn: async () => {
      const response = await fetch("/api/automations");
      if (!response.ok) throw new Error("Erro ao carregar automações");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Automation>) => {
      const response = await apiRequest("POST", "/api/automations", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: "Sucesso!", description: "Automação criada com sucesso." });
      closeModal();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível criar a automação.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Automation> }) => {
      const response = await apiRequest("PUT", `/api/automations/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: "Sucesso!", description: "Automação atualizada com sucesso." });
      closeModal();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível atualizar a automação.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/automations/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({ title: "Sucesso!", description: "Automação excluída com sucesso." });
      setIsDeleteDialogOpen(false);
      setAutomationToDelete(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível excluir a automação.", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PATCH", `/api/automations/${id}/toggle`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível alternar a automação.", variant: "destructive" });
    },
  });

  const openCreateModal = () => {
    setEditingAutomation(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (automation: Automation) => {
    setEditingAutomation(automation);
    setFormData({
      title: automation.title,
      description: automation.description,
      icon: automation.icon,
      isActive: automation.isActive,
      stats: automation.stats || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAutomation(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const automationData = {
      title: formData.title,
      description: formData.description,
      icon: formData.icon,
      isActive: formData.isActive,
      stats: formData.stats || "0 execuções",
    };

    if (editingAutomation) {
      updateMutation.mutate({ id: editingAutomation.id, data: automationData });
    } else {
      createMutation.mutate(automationData);
    }
  };

  const openDeleteDialog = (automation: Automation) => {
    setAutomationToDelete(automation);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (automationToDelete) {
      deleteMutation.mutate(automationToDelete.id);
    }
  };

  const applyTemplate = (template: typeof triggerTemplates[0]) => {
    setFormData({
      ...formData,
      title: template.name,
      description: `${template.trigger} → ${template.action}`,
      icon: template.icon,
    });
  };

  const handleToggle = (automation: Automation) => {
    toggleMutation.mutate(automation.id);
  };

  const getIconComponent = (iconName: string) => {
    return iconMap[iconName] || Zap;
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Automações</h1>
            <p className="text-sm text-muted-foreground">Configure regras de "Se Isso, Então Aquilo" para sua loja.</p>
          </div>
          <Button 
            className="gap-2 bg-amber-500 hover:bg-amber-600 text-black w-full sm:w-auto" 
            onClick={openCreateModal}
            data-testid="button-new-automation"
          >
            <Zap className="h-4 w-4" />
            Nova Automação
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">Nenhuma automação encontrada.</p>
            <Button variant="outline" onClick={openCreateModal} data-testid="button-create-first">
              Criar primeira automação
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {automations.map((automation) => {
              const IconComponent = getIconComponent(automation.icon);
              return (
                <Card key={automation.id} className={`relative overflow-hidden border-l-4 transition-all ${automation.isActive ? 'border-l-amber-500' : 'border-l-transparent opacity-60'}`} data-testid={`card-automation-${automation.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-md ${automation.isActive ? 'bg-amber-100' : 'bg-muted'}`}>
                        <IconComponent className={`h-5 w-5 ${automation.isActive ? 'text-amber-600' : 'text-muted-foreground'}`} />
                      </div>
                      <CardTitle className="text-base font-semibold" data-testid={`text-title-${automation.id}`}>{automation.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={automation.isActive}
                        onCheckedChange={() => handleToggle(automation)}
                        data-testid={`switch-active-${automation.id}`}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${automation.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(automation)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => openDeleteDialog(automation)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mt-2 mb-4" data-testid={`text-description-${automation.id}`}>
                      {automation.description}
                    </CardDescription>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground bg-muted/50 px-2 py-1 rounded" data-testid={`text-stats-${automation.id}`}>
                        {automation.stats}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1 h-8" 
                        onClick={() => openEditModal(automation)}
                        data-testid={`button-edit-${automation.id}`}
                      >
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="automation-modal">
          <DialogHeader>
            <DialogTitle>{editingAutomation ? "Editar Automação" : "Nova Automação"}</DialogTitle>
            <DialogDescription>
              {editingAutomation 
                ? "Atualize as configurações da automação." 
                : "Configure uma regra de automação para sua loja."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Templates Rápidos</Label>
              <div className="flex flex-wrap gap-2">
                {triggerTemplates.map((template, index) => {
                  const TemplateIcon = iconMap[template.icon] || Zap;
                  return (
                    <Button
                      key={index}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyTemplate(template)}
                      className="text-xs"
                      data-testid={`button-template-${index}`}
                    >
                      <TemplateIcon className="h-3 w-3 mr-1" />
                      {template.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Nome da Automação *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Boas-vindas ao cliente"
                  required
                  data-testid="input-automation-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icon">Ícone</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData({ ...formData, icon: value })}
                >
                  <SelectTrigger data-testid="select-icon">
                    <SelectValue placeholder="Selecione o ícone" />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((option) => {
                      const IconComp = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <IconComp className="h-4 w-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição da Regra *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Quando cliente fizer primeira compra → Enviar WhatsApp de boas-vindas"
                className="min-h-[100px]"
                required
                data-testid="textarea-description"
              />
              <p className="text-xs text-muted-foreground">
                Descreva o gatilho e a ação. Use o formato: "Quando [gatilho] → [ação]"
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Automação ativa</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-form-active"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal} data-testid="button-cancel">
                Cancelar
              </Button>
              <Button type="submit" disabled={isMutating} className="bg-amber-500 hover:bg-amber-600 text-black" data-testid="button-save-automation">
                {isMutating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingAutomation ? "Salvar" : "Criar Automação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A automação "{automationToDelete?.title}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
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
