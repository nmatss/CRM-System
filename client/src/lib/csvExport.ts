import { apiRequest } from "./queryClient";

export interface CsvColumn {
  key: string;
  label: string;
}

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  const safeText = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function serializeCsv(records: Record<string, unknown>[], columns: CsvColumn[]): string {
  return [
    columns.map((column) => escapeCsv(column.label)).join(","),
    ...records.map((record) => columns.map((column) => escapeCsv(record[column.key])).join(",")),
  ].join("\n");
}

export function downloadRecordsAsCsv(
  records: Record<string, unknown>[],
  filename: string,
  columns: CsvColumn[],
): void {
  const csv = serializeCsv(records, columns);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadJsonAsCsv(
  endpoint: string,
  filename: string,
  columns: CsvColumn[],
): Promise<void> {
  const response = await apiRequest("GET", endpoint);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Resposta de exportação inválida");

  downloadRecordsAsCsv(payload as Record<string, unknown>[], filename, columns);
}
