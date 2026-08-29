export interface ImportIssue {
  row: number;
  field?: string;
  message: string;
}

export interface ImportDuplicate {
  row: number;
  key: string;
  value: string;
  existingId: number | null;
  origin: "database" | "file";
}

export interface ImportOutcome {
  mode: "dry-run" | "commit";
  atomic: boolean;
  onDuplicate: "skip" | "update" | "fail";
  totals: {
    received: number;
    valid: number;
    invalid: number;
    duplicates: number;
    withoutKey: number;
    created: number;
    updated: number;
    skipped: number;
  };
  issues: ImportIssue[];
  totalIssues: number;
  duplicates: ImportDuplicate[];
  totalDuplicates: number;
}

/**
 * One sentence describing what a commit would do, built from the dry-run.
 * The user should not have to read a table of totals to decide.
 */
export function describeImportPlan(outcome: ImportOutcome, noun: string): string {
  const parts: string[] = [];
  if (outcome.totals.created > 0) parts.push(`${outcome.totals.created} ${noun} a criar`);
  if (outcome.totals.updated > 0) parts.push(`${outcome.totals.updated} a atualizar`);
  if (outcome.totals.skipped > 0) parts.push(`${outcome.totals.skipped} a ignorar por duplicidade`);
  if (outcome.totals.invalid > 0) parts.push(`${outcome.totals.invalid} com erro`);
  if (parts.length === 0) return "Nada a importar.";
  return `${parts.join(" · ")}.`;
}

/** True when committing would change nothing, so the action is pointless. */
export function isNoOpImport(outcome: ImportOutcome): boolean {
  return outcome.totals.created === 0 && outcome.totals.updated === 0;
}

export function describeImportResult(outcome: ImportOutcome, noun: string): string {
  const parts = [`${outcome.totals.created} ${noun} criado(s)`];
  if (outcome.totals.updated > 0) parts.push(`${outcome.totals.updated} atualizado(s)`);
  if (outcome.totals.skipped > 0) parts.push(`${outcome.totals.skipped} ignorado(s)`);
  if (outcome.totals.invalid > 0) parts.push(`${outcome.totals.invalid} com erro`);
  return `${parts.join(" · ")}.`;
}
