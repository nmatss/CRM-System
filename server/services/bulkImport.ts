import { z } from "zod";
import { sqlite } from "../db";
import { enqueueAutomationJobsForEvent } from "./automationEngine";

/**
 * Bulk import of customers and products (Fase 3 do plano de conclusão).
 *
 * Three properties the previous implementation did not have:
 *
 * - **dry-run**: the operator sees exactly what would happen before anything is
 *   written, instead of committing a spreadsheet blind;
 * - **deduplication**: re-uploading the same file is the most common real
 *   action, and it used to create a second copy of every row;
 * - **configurable atomicity**: a file can be committed all-or-nothing, so a
 *   failure halfway does not leave a half-imported catalogue.
 *
 * It also stops inventing data: the previous version defaulted every imported
 * customer's "last purchase" to today, fabricating a purchase that never
 * happened.
 */

export const MAX_IMPORT_ROWS = 1000;
const MAX_REPORTED_ISSUES = 50;
const MAX_REPORTED_DUPLICATES = 50;

export const IMPORT_MODES = ["dry-run", "commit"] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

export const DUPLICATE_STRATEGIES = ["skip", "update", "fail"] as const;
export type DuplicateStrategy = (typeof DUPLICATE_STRATEGIES)[number];

export interface ImportIssue {
  /** 1-based index in the submitted file, so it matches what the user sees. */
  row: number;
  field?: string;
  message: string;
}

export interface ImportDuplicate {
  row: number;
  key: string;
  value: string;
  existingId: number | null;
  /** `file` when the same key appears twice in the upload itself. */
  origin: "database" | "file";
}

export interface ImportOutcome {
  mode: ImportMode;
  atomic: boolean;
  onDuplicate: DuplicateStrategy;
  totals: {
    received: number;
    valid: number;
    invalid: number;
    duplicates: number;
    /** Rows with no deduplication key: they cannot be recognised on re-upload. */
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

export class ImportRefusedError extends Error {
  constructor(
    readonly outcome: ImportOutcome,
    message: string,
  ) {
    super(message);
    this.name = "ImportRefusedError";
  }
}

const trimmedText = (max: number) => z.string().trim().max(max);

/** Accepts the Portuguese header names real spreadsheets use. */
function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

const importedNumber = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}, z.number().finite().nonnegative().optional());

/**
 * Real spreadsheets in Brazil carry `DD/MM/AAAA`; the API stores `AAAA-MM-DD`.
 * Returns `null` for a value that is present but unparseable, so the row is
 * reported instead of silently losing the date.
 */
export function normalizeImportedDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const text = String(value).trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);

  let year: number;
  let month: number;
  let day: number;
  if (iso) {
    [, year, month, day] = [0, Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (br) {
    [, day, month, year] = [0, Number(br[1]), Number(br[2]), Number(br[3])];
  } else {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const customerRowSchema = z.object({
  name: trimmedText(120).min(2, "Nome deve ter ao menos 2 caracteres"),
  email: trimmedText(254).email("Email inválido").toLowerCase().optional(),
  phone: trimmedText(30).optional(),
  segment: z.enum(["VIP", "Novo", "Regular", "Em Risco", "Inativo"]).default("Novo"),
  ltv: importedNumber,
  favoriteCategory: trimmedText(80).optional(),
  // Only set when the file actually carries it. Defaulting this to "today" was
  // fabricating a purchase that never happened.
  lastPurchase: z
    .preprocess(normalizeImportedDate, z.string().nullable())
    .optional()
    .transform((value) => value ?? undefined)
    .refine((value) => value !== null, { message: "Use AAAA-MM-DD ou DD/MM/AAAA" }),
});

const productRowSchema = z.object({
  name: trimmedText(120).min(2, "Nome deve ter ao menos 2 caracteres"),
  category: trimmedText(80).min(1, "Categoria é obrigatória"),
  price: importedNumber,
  stock: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = Number(String(value).replace(/[^\d-]/g, ""));
    return Number.isFinite(parsed) ? Math.trunc(parsed) : Number.NaN;
  }, z.number().int().nonnegative().optional()),
  status: z.enum(["Ativo", "Inativo", "Rascunho"]).default("Ativo"),
  image: trimmedText(512).optional(),
});

type CustomerRow = z.infer<typeof customerRowSchema>;
type ProductRow = z.infer<typeof productRowSchema>;

interface PreparedRow<T> {
  index: number;
  value: T;
  key: string | null;
}

export interface ImportRequest {
  tenantId: number;
  rows: unknown[];
  mode: ImportMode;
  onDuplicate: DuplicateStrategy;
  atomic: boolean;
}

function emptyOutcome(request: ImportRequest, received: number): ImportOutcome {
  return {
    mode: request.mode,
    atomic: request.atomic,
    onDuplicate: request.onDuplicate,
    totals: {
      received,
      valid: 0,
      invalid: 0,
      duplicates: 0,
      withoutKey: 0,
      created: 0,
      updated: 0,
      skipped: 0,
    },
    issues: [],
    totalIssues: 0,
    duplicates: [],
    totalDuplicates: 0,
  };
}

/**
 * Shared pipeline: validate every row, resolve duplicates against the database
 * and against the file itself, then either project the result (dry-run) or
 * apply it.
 */
function runImport<T>(
  request: ImportRequest,
  options: {
    parse: (row: Record<string, unknown>) => z.SafeParseReturnType<unknown, T>;
    keyOf: (value: T) => string | null;
    keyName: string;
    loadExisting: (tenantId: number, keys: string[]) => Map<string, number>;
    create: (tenantId: number, value: T) => void;
    update: (tenantId: number, existingId: number, value: T) => void;
  },
): ImportOutcome {
  const outcome = emptyOutcome(request, request.rows.length);
  const issues: ImportIssue[] = [];
  const prepared: PreparedRow<T>[] = [];

  request.rows.forEach((raw, index) => {
    const rowNumber = index + 1;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      issues.push({ row: rowNumber, message: "Formato de linha inválido" });
      return;
    }

    const result = options.parse(raw as Record<string, unknown>);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({
          row: rowNumber,
          field: issue.path.map(String).join(".") || undefined,
          message: issue.message,
        });
      }
      return;
    }

    prepared.push({ index: rowNumber, value: result.data, key: options.keyOf(result.data) });
  });

  outcome.totals.invalid = outcome.totals.received - prepared.length;
  outcome.totals.valid = prepared.length;
  outcome.totals.withoutKey = prepared.filter((row) => row.key === null).length;

  const keys = Array.from(
    new Set(prepared.map((row) => row.key).filter((key): key is string => key !== null)),
  );
  const existing = keys.length > 0 ? options.loadExisting(request.tenantId, keys) : new Map();

  const duplicates: ImportDuplicate[] = [];
  const seenInFile = new Map<string, number>();
  const actions: Array<{ row: PreparedRow<T>; action: "create" | "update" | "skip" }> = [];

  for (const row of prepared) {
    if (row.key === null) {
      actions.push({ row, action: "create" });
      continue;
    }

    const firstSeenAt = seenInFile.get(row.key);
    if (firstSeenAt !== undefined) {
      duplicates.push({
        row: row.index,
        key: options.keyName,
        value: row.key,
        existingId: null,
        origin: "file",
      });
      actions.push({ row, action: request.onDuplicate === "update" ? "update" : "skip" });
      continue;
    }
    seenInFile.set(row.key, row.index);

    const existingId = existing.get(row.key);
    if (existingId !== undefined) {
      duplicates.push({
        row: row.index,
        key: options.keyName,
        value: row.key,
        existingId,
        origin: "database",
      });
      actions.push({ row, action: request.onDuplicate === "update" ? "update" : "skip" });
      continue;
    }

    actions.push({ row, action: "create" });
  }

  outcome.totals.duplicates = duplicates.length;
  outcome.issues = issues.slice(0, MAX_REPORTED_ISSUES);
  outcome.totalIssues = issues.length;
  outcome.duplicates = duplicates.slice(0, MAX_REPORTED_DUPLICATES);
  outcome.totalDuplicates = duplicates.length;

  // `fail` means the operator asked to be stopped rather than guess.
  if (request.onDuplicate === "fail" && duplicates.length > 0) {
    throw new ImportRefusedError(
      outcome,
      `Importação recusada: ${duplicates.length} duplicata(s) encontrada(s)`,
    );
  }
  if (request.atomic && issues.length > 0) {
    throw new ImportRefusedError(
      outcome,
      `Importação atômica recusada: ${issues.length} problema(s) de validação`,
    );
  }

  const projected = {
    created: actions.filter((entry) => entry.action === "create").length,
    updated: actions.filter((entry) => entry.action === "update").length,
    skipped: actions.filter((entry) => entry.action === "skip").length,
  };

  if (request.mode === "dry-run") {
    // A projection, not a promise: nothing is written.
    outcome.totals.created = projected.created;
    outcome.totals.updated = projected.updated;
    outcome.totals.skipped = projected.skipped;
    return outcome;
  }

  const applyAll = () => {
    for (const entry of actions) {
      if (entry.action === "skip") {
        outcome.totals.skipped += 1;
        continue;
      }
      if (entry.action === "update") {
        const existingId = existing.get(entry.row.key as string);
        if (existingId === undefined) {
          // A duplicate inside the file whose first occurrence was just created.
          outcome.totals.skipped += 1;
          continue;
        }
        options.update(request.tenantId, existingId, entry.row.value);
        outcome.totals.updated += 1;
        continue;
      }
      options.create(request.tenantId, entry.row.value);
      outcome.totals.created += 1;
    }
  };

  if (request.atomic) {
    sqlite.transaction(applyAll)();
  } else {
    applyAll();
  }

  return outcome;
}

function loadExistingByColumn(table: string, column: string) {
  return (tenantId: number, keys: string[]): Map<string, number> => {
    const map = new Map<string, number>();
    // Chunked so a 1000-row file cannot exceed the SQLite parameter limit.
    for (let start = 0; start < keys.length; start += 400) {
      const chunk = keys.slice(start, start + 400);
      const placeholders = chunk.map(() => "?").join(",");
      const rows = sqlite
        .prepare(
          `SELECT id, LOWER(TRIM(${column})) AS matchKey FROM ${table}
            WHERE tenant_id = ? AND LOWER(TRIM(${column})) IN (${placeholders})`,
        )
        .all(tenantId, ...chunk) as Array<{ id: number; matchKey: string }>;
      for (const row of rows) {
        if (!map.has(row.matchKey)) map.set(row.matchKey, row.id);
      }
    }
    return map;
  };
}

export function importCustomers(request: ImportRequest): ImportOutcome {
  return runImport<CustomerRow>(request, {
    keyName: "email",
    parse: (row) =>
      customerRowSchema.safeParse({
        name: pick(row, "name", "nome"),
        email: pick(row, "email", "e-mail"),
        phone: pick(row, "phone", "telefone", "celular"),
        segment: pick(row, "segment", "segmento"),
        ltv: pick(row, "ltv", "valor", "valorTotal"),
        favoriteCategory: pick(row, "favoriteCategory", "categoriaFavorita"),
        lastPurchase: pick(row, "lastPurchase", "ultimaCompra"),
      }),
    keyOf: (value) => value.email ?? null,
    loadExisting: loadExistingByColumn("customers", "email"),
    create: (tenantId, value) => {
      const ltvCents = Math.round((value.ltv ?? 0) * 100);
      const info = sqlite
        .prepare(
          `INSERT INTO customers (tenant_id, name, email, phone, segment, ltv, ltv_cents, last_purchase, favorite_category)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          tenantId,
          value.name,
          value.email ?? "",
          value.phone ?? null,
          value.segment,
          value.ltv ?? 0,
          ltvCents,
          value.lastPurchase ?? null,
          value.favoriteCategory ?? null,
        );

      // A bulk import is still customer creation, so the trigger fires.
      enqueueAutomationJobsForEvent({
        tenantId,
        triggerType: "customer.created",
        referenceId: Number(info.lastInsertRowid),
      });
    },
    update: (tenantId, existingId, value) => {
      sqlite
        .prepare(
          `UPDATE customers
              SET name = ?, phone = COALESCE(?, phone), segment = ?,
                  favorite_category = COALESCE(?, favorite_category),
                  last_purchase = COALESCE(?, last_purchase),
                  updated_at = datetime('now')
            WHERE id = ? AND tenant_id = ?`,
        )
        .run(
          value.name,
          value.phone ?? null,
          value.segment,
          value.favoriteCategory ?? null,
          value.lastPurchase ?? null,
          existingId,
          tenantId,
        );
    },
  });
}

export function importProducts(request: ImportRequest): ImportOutcome {
  return runImport<ProductRow>(request, {
    keyName: "name",
    parse: (row) =>
      productRowSchema.safeParse({
        name: pick(row, "name", "nome"),
        category: pick(row, "category", "categoria"),
        price: pick(row, "price", "preco", "preço"),
        stock: pick(row, "stock", "estoque"),
        status: pick(row, "status", "situacao"),
        image: pick(row, "image", "imagem"),
      }),
    keyOf: (value) => value.name.toLowerCase(),
    loadExisting: loadExistingByColumn("products", "name"),
    create: (tenantId, value) => {
      const priceCents = Math.round((value.price ?? 0) * 100);
      sqlite
        .prepare(
          `INSERT INTO products (tenant_id, name, category, price, price_cents, stock, status, image)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          tenantId,
          value.name,
          value.category,
          value.price ?? 0,
          priceCents,
          value.stock ?? 0,
          value.status,
          value.image ?? null,
        );
    },
    update: (tenantId, existingId, value) => {
      const priceCents = Math.round((value.price ?? 0) * 100);
      sqlite
        .prepare(
          `UPDATE products
              SET category = ?, price = ?, price_cents = ?, stock = ?, status = ?,
                  image = COALESCE(?, image), updated_at = datetime('now')
            WHERE id = ? AND tenant_id = ?`,
        )
        .run(
          value.category,
          value.price ?? 0,
          priceCents,
          value.stock ?? 0,
          value.status,
          value.image ?? null,
          existingId,
          tenantId,
        );
    },
  });
}
