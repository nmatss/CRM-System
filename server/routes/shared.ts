/**
 * Cross-cutting helpers, guards and request schemas shared by the domain
 * routers in this directory.
 *
 * `server/routes.ts` is now only a composition root: it wires the middleware
 * and mounts each domain router in the order Express must see them.
 */

import type { Express, Request, Response } from "express";
import express from "express";
import { type Server } from "http";
import { CashbackLedgerError, OrderDomainError, storage, type AuditAction } from "../storage";
import {
  insertCustomerSchema,
  insertProductSchema,
  insertCashbackRuleSchema,
  insertCampaignSchema,
  insertAutomationSchema,
  insertTenantSchema,
  insertContactRequestSchema,
  insertDemoRequestSchema,
  insertSellerTaskSchema,
  loginSchema,
  registerSchema,
  normalizeEmail,
  SUPPORTED_AUTOMATION_ACTIONS,
  SUPPORTED_AUTOMATION_TRIGGERS,
  SUPPORTED_DELIVERY_CHANNELS,
  PRIVACY_POLICY_VERSION,
  publicContactSchema,
  publicDemoSchema,
} from "@shared/schema";
import {
  setupSession,
  hashPassword,
  comparePassword,
  requireAuth,
  requireSuperAdmin,
  requireTenantContext,
  requireRole,
  createSuperAdminIfNotExists,
  SESSION_COOKIE_NAME,
} from "../auth";
import { logger } from "../logger";
import { setupCsrf } from "../csrf";
import { z, ZodError } from "zod";
import {
  authAccountLimiter,
  authIpLimiter,
  registerLimiter,
  passwordResetLimiter,
  publicLeadLimiter,
} from "../rateLimit";
import { checkAndSeed } from "../seed";
import { OutboxConflictError, getOutboxBacklog } from "../outbox";
import { buildInfo } from "../buildInfo";
import { renderMetrics } from "../metrics";
import {
  CampaignDispatchError,
  getCampaignDeliveryStats,
  listCampaignExecutions,
  listCampaignRecipients,
  requestCampaignDispatch,
  supportedAudiences,
} from "../services/campaignDispatch";
import { getAutomationHistory } from "../services/automationEngine";
import { configuredChannels } from "../services/delivery";

// ==================== ERROR HANDLING UTILITIES ====================
interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
}

function sendError(
  res: Response,
  status: number,
  message: string,
  code?: string,
  details?: any,
): void {
  const response: ErrorResponse = { error: message };
  if (code) response.code = code;
  if (details) response.details = details;
  res.status(status).json(response);
}

function handleZodError(error: ZodError): { message: string; details: any } {
  const fieldErrors: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join(".");
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(err.message);
  });

  return {
    message: "Erro de validação",
    details: {
      fields: fieldErrors,
      errors: error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code,
      })),
    },
  };
}

export function sanitizeSpreadsheetCell(value: unknown): unknown {
  if (typeof value === "string" && /^\s*[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

function sanitizeExportRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(
    (row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, sanitizeSpreadsheetCell(value)]),
      ) as T,
  );
}

// ==================== HELPER FUNCTIONS ====================
/**
 * Safely retrieves the authenticated user's tenantId from session.
 * SECURITY: Never trusts URL parameters - only uses session data.
 *
 * @throws Error if user is not authenticated or has no tenant assigned
 * @returns The authenticated user's tenantId
 */
function getTenantId(req: Request): number {
  if (!req.session.user) {
    throw new Error("User not authenticated");
  }

  if (!req.session.user.tenantId) {
    throw new Error("User has no tenant assigned");
  }

  return req.session.user.tenantId;
}

function getAuditContext(req: Request) {
  return {
    actorUserId: req.session?.user?.id ?? null,
    requestId: String((req as Request & { requestId?: string }).requestId || crypto.randomUUID()),
  };
}

async function auditLogin(
  req: Request,
  input: {
    tenantId?: number | null;
    actorUserId?: string | null;
    outcome: "success" | "failure";
    identifierType: "email" | "cpf" | "unknown";
    reason?: string;
  },
) {
  return storage.appendAuditEvent({
    ...getAuditContext(req),
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: "auth.login",
    targetType: "user",
    targetId: input.actorUserId,
    outcome: input.outcome,
    metadata: { identifierType: input.identifierType, reason: input.reason },
  });
}

async function auditLoginOrFailClosed(
  req: Request,
  res: Response,
  input: Parameters<typeof auditLogin>[1],
): Promise<boolean> {
  try {
    await auditLogin(req, input);
    return true;
  } catch (_error) {
    sendError(res, 503, "Autenticação temporariamente indisponível", "AUDIT_UNAVAILABLE");
    return false;
  }
}

function parseImportedNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const normalized = trimmed.includes(",")
    ? trimmed
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
    : trimmed.replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve) => {
    req.session.destroy(() => resolve());
  });
}

function requireStrongTemporaryPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 12) {
    throw new Error("Senha temporária deve ter pelo menos 12 caracteres");
  }
  return value;
}

function normalizeAssignableRole(value: unknown): "seller" | "manager" {
  return value === "manager" ? "manager" : "seller";
}

const MAX_IMPORT_ROWS = 1000;
const MAX_IMPORT_FIELD_LENGTH = 512;
const nonNegativeImportedNumber = z.preprocess(
  (value) => parseImportedNumber(value, Number.NaN),
  z.number().finite().nonnegative(),
);
const nonNegativeImportedInteger = z.preprocess(
  (value) => parseImportedNumber(value, Number.NaN),
  z.number().int().nonnegative(),
);
const updateCustomerSchema = insertCustomerSchema.partial().omit({ tenantId: true }).extend({
  ltv: nonNegativeImportedNumber.optional(),
});
const updateProductSchema = insertProductSchema.partial().omit({ tenantId: true }).extend({
  price: nonNegativeImportedNumber.optional(),
  stock: nonNegativeImportedInteger.optional(),
});
const safeOrderDateSchema = z.string().refine((value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }
  return z.string().datetime().safeParse(value).success;
}, "Data do pedido deve usar YYYY-MM-DD ou ISO 8601");
const orderStatusSchema = z.enum([
  "Pendente",
  "Processando",
  "Pago",
  "Enviado",
  "Entregue",
  "Cancelado",
]);
const updateOrderSchema = z
  .object({
    customerId: z.number().int().positive().nullable().optional(),
    customer: z.string().trim().min(1).max(200).optional(),
    orderDate: safeOrderDateSchema.optional(),
    status: orderStatusSchema.optional(),
    method: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
const transactionalOrderCreateSchema = z.object({
  customerId: z.number().int().positive().nullable().optional(),
  customer: z.string().trim().min(1).max(200),
  method: z.string().trim().min(1).max(100),
  orderDate: safeOrderDateSchema.optional(),
  status: orderStatusSchema
    .optional()
    .refine((status) => status !== "Cancelado", "Pedido novo não pode ser criado como cancelado"),
  lineItems: z
    .array(
      z
        .object({
          productId: z.number().int().positive(),
          quantity: z.number().int().positive().max(10000),
        })
        .strict(),
    )
    .min(1)
    .max(100),
});
const automationDefinitionShape = {
  triggerType: z.enum(SUPPORTED_AUTOMATION_TRIGGERS),
  actionType: z.enum(SUPPORTED_AUTOMATION_ACTIONS),
  actionChannel: z.enum(SUPPORTED_DELIVERY_CHANNELS),
};
// Only triggers, actions and channels the engine can execute may be persisted.
const createAutomationSchema = insertAutomationSchema.extend(automationDefinitionShape);
const updateAutomationSchema = insertAutomationSchema
  .extend(automationDefinitionShape)
  .partial()
  .omit({ tenantId: true });
const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const executionListQuerySchema = paginationQuerySchema.extend({
  campaignId: z.coerce.number().int().positive().optional(),
});
const automationHistoryQuerySchema = paginationQuerySchema.extend({
  automationId: z.coerce.number().int().positive().optional(),
});
const listQueryShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value || undefined),
};
const boundedLimitSchema = z.coerce.number().int().min(1).max(100);
const cashbackLedgerOperationSchema = z
  .object({
    customerId: z.number().int().positive(),
    amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    idempotencyKey: z.string().trim().min(8).max(200),
    description: z.string().trim().min(1).max(500),
    source: z.enum(["manual", "promotion", "support", "redemption"]),
    ruleId: z.number().int().positive().nullable().optional(),
    orderId: z.number().int().positive().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict();
const reportDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, "Data inválida");
const reportQuerySchema = z
  .object({
    startDate: reportDateSchema.optional(),
    endDate: reportDateSchema.optional(),
    timezone: z.literal("UTC").default("UTC"),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.startDate === undefined) !== (value.endDate === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate e endDate devem ser enviados juntos",
      });
    }
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate deve ser anterior ou igual a endDate",
      });
    }
  });
const customerListQuerySchema = z
  .object({
    ...listQueryShape,
    segment: z.enum(["VIP", "Novo", "Regular", "Em Risco", "Inativo"]).optional(),
    sort: z.literal("name").default("name"),
    order: z.enum(["asc", "desc"]).default("asc"),
  })
  .strict();
const productListQuerySchema = z
  .object({
    ...listQueryShape,
    status: z.enum(["Ativo", "Inativo", "Rascunho"]).optional(),
    sort: z.literal("name").default("name"),
    order: z.enum(["asc", "desc"]).default("asc"),
  })
  .strict();
const orderListQuerySchema = z
  .object({
    ...listQueryShape,
    status: z
      .enum(["Pendente", "Processando", "Pago", "Enviado", "Entregue", "Cancelado"])
      .optional(),
    sort: z.literal("orderDate").default("orderDate"),
    order: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

function sanitizeImportedText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value).trim().slice(0, MAX_IMPORT_FIELD_LENGTH);
}

function isSellerSession(req: Request): boolean {
  return !req.session.user?.isSuperAdmin && req.session.user?.role === "seller";
}

function scopeUserFilterToSession(req: Request, requestedUserId?: string): string | undefined {
  return isSellerSession(req) ? req.session.user!.id : requestedUserId;
}

async function isCustomerInTenant(tenantId: number, customerId: number): Promise<boolean> {
  return Boolean(await storage.getCustomer(tenantId, customerId));
}

async function isActiveUserInTenant(tenantId: number, userId: string): Promise<boolean> {
  const membership = await storage.getTenantUser(tenantId, userId);
  return Boolean(membership?.isActive);
}

export {
  ErrorResponse,
  MAX_IMPORT_FIELD_LENGTH,
  MAX_IMPORT_ROWS,
  auditLogin,
  auditLoginOrFailClosed,
  automationDefinitionShape,
  automationHistoryQuerySchema,
  boundedLimitSchema,
  cashbackLedgerOperationSchema,
  createAutomationSchema,
  customerListQuerySchema,
  destroySession,
  executionListQuerySchema,
  getAuditContext,
  getTenantId,
  handleZodError,
  isActiveUserInTenant,
  isCustomerInTenant,
  isSellerSession,
  listQueryShape,
  nonNegativeImportedInteger,
  nonNegativeImportedNumber,
  normalizeAssignableRole,
  orderListQuerySchema,
  orderStatusSchema,
  paginationQuerySchema,
  parseImportedNumber,
  productListQuerySchema,
  regenerateSession,
  reportDateSchema,
  reportQuerySchema,
  requireStrongTemporaryPassword,
  safeOrderDateSchema,
  sanitizeExportRows,
  sanitizeImportedText,
  saveSession,
  scopeUserFilterToSession,
  sendError,
  transactionalOrderCreateSchema,
  updateAutomationSchema,
  updateCustomerSchema,
  updateOrderSchema,
  updateProductSchema,
};

// Single import surface for the domain routers in this directory.
export {
  CampaignDispatchError,
  CashbackLedgerError,
  OrderDomainError,
  OutboxConflictError,
  SESSION_COOKIE_NAME,
  SUPPORTED_AUTOMATION_ACTIONS,
  SUPPORTED_AUTOMATION_TRIGGERS,
  SUPPORTED_DELIVERY_CHANNELS,
  ZodError,
  authAccountLimiter,
  authIpLimiter,
  buildInfo,
  checkAndSeed,
  comparePassword,
  configuredChannels,
  createSuperAdminIfNotExists,
  express,
  getAutomationHistory,
  getCampaignDeliveryStats,
  getOutboxBacklog,
  hashPassword,
  insertAutomationSchema,
  insertCampaignSchema,
  insertCashbackRuleSchema,
  insertContactRequestSchema,
  insertCustomerSchema,
  insertDemoRequestSchema,
  insertProductSchema,
  insertSellerTaskSchema,
  insertTenantSchema,
  listCampaignExecutions,
  listCampaignRecipients,
  logger,
  loginSchema,
  normalizeEmail,
  passwordResetLimiter,
  PRIVACY_POLICY_VERSION,
  publicContactSchema,
  publicDemoSchema,
  publicLeadLimiter,
  registerLimiter,
  registerSchema,
  renderMetrics,
  requestCampaignDispatch,
  requireAuth,
  requireRole,
  requireSuperAdmin,
  requireTenantContext,
  setupCsrf,
  setupSession,
  storage,
  supportedAudiences,
  z,
};
export type { AuditAction, Express, Request, Response, Server };
