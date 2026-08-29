import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MoreHorizontal,
  ArrowUpDown,
  Pencil,
  Copy,
  Pause,
  Play,
  Trash2,
  Filter,
  X,
} from "lucide-react";
import type { CashbackRule } from "@shared/schema";

interface CashbackRulesTableProps {
  rules: CashbackRule[];
  isLoading?: boolean;
  onEdit: (rule: CashbackRule) => void;
  onDelete: (rule: CashbackRule) => void;
  onDuplicate?: (rule: CashbackRule) => void;
  onToggleStatus?: (rule: CashbackRule) => void;
  canManage?: boolean;
}

type SortField = "name" | "condition" | "value" | "status";
type SortDirection = "asc" | "desc";

function SortButton({
  field,
  label,
  onSort,
}: {
  field: SortField;
  label: string;
  onSort: (field: SortField) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

export function CashbackRulesTable({
  rules,
  isLoading,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
  canManage = false,
}: CashbackRulesTableProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedRules = rules
    .filter((rule) => {
      const matchesStatus =
        statusFilter === "all" || rule.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch =
        rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.trigger.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      switch (sortField) {
        case "name":
          return direction * a.name.localeCompare(b.name);
        case "condition":
          return direction * a.trigger.localeCompare(b.trigger);
        case "value":
          return direction * (a.value - b.value);
        case "status":
          return direction * a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

  const clearFilters = () => {
    setStatusFilter("all");
    setSearchTerm("");
  };

  const hasActiveFilters = statusFilter !== "all" || searchTerm !== "";

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base sm:text-lg">Regras de Cashback Ativas</CardTitle>
            <CardDescription className="text-sm">
              Gerencie a configuração e o status de suas regras
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-[200px]">
              <Input
                placeholder="Buscar regras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 w-full"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 flex-1 sm:w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                  <SelectItem value="expirado">Expirado</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 px-3">
                  <X className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Limpar</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 flex-1" />
              </div>
            ))}
          </div>
        ) : filteredAndSortedRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              {hasActiveFilters
                ? "Nenhuma regra encontrada com os filtros aplicados."
                : "Nenhuma regra de cashback configurada."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="h-10">
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortButton field="name" label="Nome" onSort={handleSort} />
                    </TableHead>
                    <TableHead>
                      <SortButton field="condition" label="Condição" onSort={handleSort} />
                    </TableHead>
                    <TableHead>
                      <SortButton field="value" label="Percentual" onSort={handleSort} />
                    </TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>
                      <SortButton field="status" label="Status" onSort={handleSort} />
                    </TableHead>
                    {canManage && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedRules.map((rule) => {
                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{rule.trigger}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {rule.value}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {rule.validity === 0 ? "Sem expiração" : `${rule.validity} dias`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              rule.status === "Ativo"
                                ? "default"
                                : rule.status === "Pausado"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {rule.status}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => onEdit(rule)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                {onToggleStatus && (
                                  <DropdownMenuItem onClick={() => onToggleStatus(rule)}>
                                    {rule.status === "Ativo" ? (
                                      <>
                                        <Pause className="mr-2 h-4 w-4" />
                                        Pausar
                                      </>
                                    ) : (
                                      <>
                                        <Play className="mr-2 h-4 w-4" />
                                        Ativar
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                )}
                                {onDuplicate && (
                                  <DropdownMenuItem onClick={() => onDuplicate(rule)}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Duplicar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDelete(rule)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden space-y-4">
              {filteredAndSortedRules.map((rule) => {
                return (
                  <div key={rule.id} className="border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm sm:text-base truncate">{rule.name}</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
                          {rule.trigger}
                        </p>
                      </div>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 flex-shrink-0 -mt-1"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onEdit(rule)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            {onToggleStatus && (
                              <DropdownMenuItem onClick={() => onToggleStatus(rule)}>
                                {rule.status === "Ativo" ? (
                                  <>
                                    <Pause className="mr-2 h-4 w-4" />
                                    Pausar
                                  </>
                                ) : (
                                  <>
                                    <Play className="mr-2 h-4 w-4" />
                                    Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                            {onDuplicate && (
                              <DropdownMenuItem onClick={() => onDuplicate(rule)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onDelete(rule)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="font-mono text-xs sm:text-sm">
                        {rule.value}%
                      </Badge>
                      <Badge
                        variant={
                          rule.status === "Ativo"
                            ? "default"
                            : rule.status === "Pausado"
                              ? "secondary"
                              : "destructive"
                        }
                        className="text-xs sm:text-sm"
                      >
                        {rule.status}
                      </Badge>
                    </div>

                    <div className="pt-3 border-t text-sm">
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-xs mb-1">Validade</p>
                        <p className="font-medium text-xs break-words">
                          {rule.validity === 0 ? "Sem expiração" : `${rule.validity} dias`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
