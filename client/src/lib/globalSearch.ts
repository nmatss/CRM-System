export type SearchType = "customer" | "product" | "order";

export interface SearchHit {
  type: SearchType;
  id: number;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  totals: Record<SearchType, number>;
  truncated: boolean;
}

export const MIN_SEARCH_LENGTH = 2;

const typeLabels: Record<SearchType, string> = {
  customer: "Cliente",
  product: "Produto",
  order: "Pedido",
};

export function searchTypeLabel(type: SearchType): string {
  return typeLabels[type] ?? type;
}

/** Whether a term is worth sending; below this the server refuses it anyway. */
export function isSearchable(term: string): boolean {
  return term.trim().length >= MIN_SEARCH_LENGTH;
}

/**
 * One line describing the result set, announced to assistive technology so a
 * screen reader user knows the list changed.
 */
export function describeSearchResult(result: SearchResult | undefined): string {
  if (!result) return "";
  const total = result.totals.customer + result.totals.product + result.totals.order;
  if (total === 0) return "Nenhum resultado encontrado.";
  const shown = result.hits.length;
  if (result.truncated) return `${shown} de ${total} resultados.`;
  return `${total} resultado${total === 1 ? "" : "s"}.`;
}
