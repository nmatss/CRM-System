const campaignStatuses: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Envio agendado",
  processing: "Processando",
  sent: "Enviada",
  failed: "Falhou",
  cancelled: "Cancelada",
  Rascunho: "Rascunho",
};

export function campaignStatusLabel(status: string): string {
  return campaignStatuses[status] ?? status;
}

const recipientStatuses: Record<string, string> = {
  pending: "Pendente",
  delivered: "Entregue",
  failed: "Falhou",
  skipped_opt_out: "Ignorado (opt-out)",
  not_configured: "Canal não configurado",
};

/** Per-recipient state. "Entregue" is only used when a provider acknowledged it. */
export function recipientStatusLabel(status: string): string {
  return recipientStatuses[status] ?? status;
}

const executionStatuses: Record<string, string> = {
  scheduled: "Agendada",
  processing: "Processando",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

export function executionStatusLabel(status: string): string {
  return executionStatuses[status] ?? status;
}

const automationExecutionStatuses: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  succeeded: "Executada",
  failed: "Falhou",
  skipped: "Ignorada",
};

export function automationExecutionStatusLabel(status: string): string {
  return automationExecutionStatuses[status] ?? status;
}

export function formatMetric(value: number, suffix = ""): string {
  if (!Number.isFinite(value)) return "Indisponível";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

/**
 * Attribution metrics stay unavailable until real attribution events exist
 * (ADR 0002), so a null must never be rendered as a zero.
 */
export function formatOptionalMetric(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined) return "Indisponível";
  return formatMetric(value, suffix);
}
