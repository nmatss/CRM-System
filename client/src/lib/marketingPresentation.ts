const campaignStatuses: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada (sem envio integrado)",
  sent: "Marcada como enviada",
  active: "Ativa",
  Rascunho: "Rascunho",
};

export function campaignStatusLabel(status: string): string {
  return campaignStatuses[status] ?? status;
}

export function formatMetric(value: number, suffix = ""): string {
  if (!Number.isFinite(value)) return "Indisponível";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}
