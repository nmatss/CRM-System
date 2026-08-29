import type { Express, Request, Response } from "express";
import express from "express";
import { type Server } from "http";
import { CashbackLedgerError, OrderDomainError, storage, type AuditAction } from "./storage";
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
} from "./auth";
import { logger } from "./logger";
import { setupCsrf } from "./csrf";
import { z, ZodError } from "zod";
import {
  authAccountLimiter,
  authIpLimiter,
  registerLimiter,
  passwordResetLimiter,
} from "./rateLimit";
import { checkAndSeed } from "./seed";
import { OutboxConflictError, getOutboxBacklog } from "./outbox";
import {
  CampaignDispatchError,
  getCampaignDeliveryStats,
  listCampaignExecutions,
  listCampaignRecipients,
  requestCampaignDispatch,
  supportedAudiences,
} from "./services/campaignDispatch";
import { getAutomationHistory } from "./services/automationEngine";
import { configuredChannels } from "./services/delivery";

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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupSession(app);

  // Add request ID middleware for tracking requests
  await createSuperAdminIfNotExists();

  // Seed database in development mode
  await checkAndSeed();

  // CSRF needs session state and must be registered before API routes.
  setupCsrf(app);

  // Create v1 API router
  const v1Router = express.Router();

  // ==================== HEALTH CHECK ====================
  // Keep health check at root for backward compatibility
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString(), version: "1.0.0" });
  });

  app.get("/api/ready", async (_req: Request, res: Response) => {
    const ready = await storage.healthCheck();
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      database: ready ? "connected" : "disconnected",
    });
  });

  v1Router.get("/admin/diagnostics/outbox", requireSuperAdmin, (_req, res) => {
    // Backlog snapshot used by the production runbook.
    res.json({ backlog: getOutboxBacklog(), configuredChannels: configuredChannels() });
  });

  v1Router.get("/admin/diagnostics/database", requireSuperAdmin, async (_req, res) => {
    const valid = await storage.deepHealthCheck();
    res.status(valid ? 200 : 503).json({ status: valid ? "ok" : "failed" });
  });

  // ==================== AUTH ROUTES ====================
  /**
   * @description Authenticates a user using CPF or email and password credentials
   * @route POST /api/v1/auth/login
   * @access public
   * @param {string} username - User's CPF (with or without formatting) or email address
   * @param {string} password - User's password
   * @returns {object} User session object and success message
   */
  v1Router.post(
    "/auth/login",
    authIpLimiter,
    authAccountLimiter,
    async (req: Request, res: Response) => {
      try {
        const { username, password } = loginSchema.parse(req.body);
        const identifierType = username.includes("@")
          ? ("email" as const)
          : username.replace(/\D/g, "").length === 11
            ? ("cpf" as const)
            : ("unknown" as const);

        // Try to find user by CPF first (cleaned), then by email
        const cleanedCpf = username.replace(/\D/g, "");
        let user = await storage.getUserByCpf(cleanedCpf);
        if (!user) {
          user = await storage.getUserByEmail(normalizeEmail(username));
        }

        if (!user) {
          if (
            !(await auditLoginOrFailClosed(req, res, {
              outcome: "failure",
              identifierType,
              reason: "invalid_credentials",
            }))
          )
            return;
          return sendError(res, 401, "Usuário ou senha inválidos", "INVALID_CREDENTIALS");
        }

        if (user.status !== "active") {
          if (
            !(await auditLoginOrFailClosed(req, res, {
              actorUserId: user.id,
              outcome: "failure",
              identifierType,
              reason: "inactive_user",
            }))
          )
            return;
          return sendError(
            res,
            401,
            "Usuário inativo. Entre em contato com o administrador.",
            "USER_INACTIVE",
          );
        }

        const isValid = await comparePassword(password, user.password);
        if (!isValid) {
          if (
            !(await auditLoginOrFailClosed(req, res, {
              actorUserId: user.id,
              outcome: "failure",
              identifierType,
              reason: "invalid_credentials",
            }))
          )
            return;
          return sendError(res, 401, "Usuário ou senha inválidos", "INVALID_CREDENTIALS");
        }

        let tenantId: number | undefined;
        let role: string | undefined;

        if (!user.isSuperAdmin) {
          const userTenants = await storage.getUserTenants(user.id);
          const activeTenant = userTenants.find((tu) => tu.isActive);
          if (activeTenant) {
            tenantId = activeTenant.tenantId;
            role = activeTenant.role;
          }
        }

        await regenerateSession(req);

        req.session.user = {
          id: user.id,
          email: user.email,
          cpf: user.cpf,
          name: user.name,
          isSuperAdmin: user.isSuperAdmin,
          mustChangePassword: user.mustChangePassword,
          lastPasswordChange: user.lastPasswordChange,
          tenantId,
          role: role as any,
        };

        await saveSession(req);

        try {
          await auditLogin(req, {
            tenantId,
            actorUserId: user.id,
            outcome: "success",
            identifierType,
          });
        } catch (_error) {
          await destroySession(req);
          res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
          return sendError(
            res,
            503,
            "Autenticação temporariamente indisponível",
            "AUDIT_UNAVAILABLE",
          );
        }

        // lastLogin is informational and only advances after session + audit succeed.
        try {
          await storage.updateUser(user.id, { lastLogin: new Date().toISOString() } as any);
        } catch (_error) {
          logger.warn("Unable to update informational lastLogin after successful authentication", {
            requestId: (req as Request & { requestId?: string }).requestId,
            userId: user.id,
          });
        }

        res.json({
          user: req.session.user,
          message: "Login realizado com sucesso",
        });
      } catch (error) {
        logger.error("Login failed", {
          requestId: (req as any).requestId,
          endpoint: "/api/v1/auth/login",
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        if (error instanceof ZodError) {
          if (
            !(await auditLoginOrFailClosed(req, res, {
              outcome: "failure",
              identifierType: "unknown",
              reason: "validation_error",
            }))
          )
            return;
          const zodError = handleZodError(error);
          return sendError(res, 400, zodError.message, "VALIDATION_ERROR", zodError.details);
        }
        return sendError(res, 400, "Dados de login inválidos", "LOGIN_ERROR");
      }
    },
  );

  /**
   * @description Logs out the current user by destroying their session
   * @route POST /api/v1/auth/logout
   * @access auth
   * @returns {object} Success message
   */
  v1Router.post("/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao fazer logout" });
      }
      res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  /**
   * @description Retrieves the currently authenticated user's session information
   * @route GET /api/v1/auth/me
   * @access auth
   * @returns {object} Current user session data
   */
  v1Router.get("/auth/me", requireAuth, (req: Request, res: Response) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    res.json({ user: req.session.user });
  });

  /**
   * @description Registers a new user account and optionally creates a new tenant organization
   * @route POST /api/v1/auth/register
   * @access public
   * @param {string} email - User's email address
   * @param {string} password - User's password (minimum 12 characters)
   * @param {string} name - User's full name
   * @param {string} [tenantName] - Optional name for a new tenant organization
   * @returns {object} Newly created user session object and success message
   */
  v1Router.post("/auth/register", registerLimiter, async (req: Request, res: Response) => {
    let registrationCreated = false;
    try {
      const { email, password, name, tenantName } = registerSchema.parse(req.body);

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return sendError(res, 400, "Email já está em uso", "DUPLICATE_EMAIL");
      }

      const hashedPassword = await hashPassword(password);
      const slug = tenantName
        ? tenantName
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
        : undefined;
      const registered = await storage.registerSelfService(
        {
          email,
          password: hashedPassword,
          name,
          isSuperAdmin: false,
          mustChangePassword: false,
        },
        tenantName
          ? {
              name: tenantName,
              slug: slug!,
              plan: "free",
              status: "active",
            }
          : undefined,
        {
          ...getAuditContext(req),
          action: "auth.register",
          targetType: "user",
          outcome: "success",
        },
      );
      registrationCreated = true;
      const user = registered.user;
      const tenantId = registered.tenant?.id;
      const role = "manager";

      await regenerateSession(req);

      req.session.user = {
        id: user.id,
        email: user.email,
        cpf: user.cpf,
        name: user.name,
        isSuperAdmin: false,
        mustChangePassword: false,
        lastPasswordChange: user.lastPasswordChange,
        tenantId,
        role: role as any,
      };

      await saveSession(req);

      res.status(201).json({
        user: req.session.user,
        message: "Registro realizado com sucesso",
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const zodError = handleZodError(error);
        return sendError(res, 400, zodError.message, "VALIDATION_ERROR", zodError.details);
      }
      if (registrationCreated) {
        return sendError(
          res,
          503,
          "Conta criada, mas a sessão não pôde ser iniciada. Faça login para continuar.",
          "ACCOUNT_CREATED_SESSION_UNAVAILABLE",
        );
      }
      return sendError(res, 400, "Dados de registro inválidos", "REGISTER_ERROR");
    }
  });

  /**
   * @description Changes the authenticated user's password
   * @route POST /api/v1/auth/change-password
   * @access auth
   * @param {string} currentPassword - User's current password
   * @param {string} newPassword - New password (minimum 12 characters)
   * @param {string} confirmPassword - New password confirmation
   * @returns {object} Success message
   */
  v1Router.post(
    "/auth/change-password",
    requireAuth,
    passwordResetLimiter,
    async (req: Request, res: Response) => {
      try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
          return res.status(400).json({ error: "Todos os campos são obrigatórios" });
        }

        if (newPassword !== confirmPassword) {
          return res.status(400).json({ error: "As senhas não conferem" });
        }

        if (newPassword.length < 12) {
          return res.status(400).json({ error: "A nova senha deve ter pelo menos 12 caracteres" });
        }

        const user = await storage.getUser(req.session.user!.id);
        if (!user) {
          return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const isValid = await comparePassword(currentPassword, user.password);
        if (!isValid) {
          return res.status(401).json({ error: "Senha atual incorreta" });
        }

        const hashedPassword = await hashPassword(newPassword);
        const updatedUser = await storage.updateUserPasswordAudited(
          user.id,
          hashedPassword,
          false,
          {
            ...getAuditContext(req),
            tenantId: req.session.user?.tenantId,
            action: "auth.password_changed",
            targetType: "user",
            outcome: "success",
            metadata: { resetType: "self_service" },
          },
        );

        req.session.user!.mustChangePassword = false;
        req.session.user!.lastPasswordChange = updatedUser?.lastPasswordChange ?? null;
        await saveSession(req);

        res.json({ message: "Senha alterada com sucesso" });
      } catch {
        res.status(400).json({ error: "Erro ao alterar senha" });
      }
    },
  );

  /**
   * @description Switches the current user's active tenant context
   * @route POST /api/v1/auth/switch-tenant/:tenantId
   * @access auth
   * @param {number} tenantId - ID of the tenant to switch to
   * @returns {object} Updated user session with new tenant context
   */
  v1Router.post(
    "/auth/switch-tenant/:tenantId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const tenantId = parseInt(req.params.tenantId);
        if (isNaN(tenantId)) {
          return sendError(res, 400, "ID de tenant inválido", "INVALID_ID");
        }
        const userId = req.session.user!.id;

        if (req.session.user!.isSuperAdmin) {
          const tenant = await storage.getTenant(tenantId);
          if (!tenant) {
            return res.status(404).json({ error: "Tenant não encontrado" });
          }
          if (tenant.status !== "active") {
            return res.status(403).json({ error: "Tenant inativo" });
          }
          req.session.user!.tenantId = tenantId;
          req.session.user!.role = "manager";
          await saveSession(req);
          return res.json({ user: req.session.user });
        }

        const tenantUser = await storage.getTenantUser(tenantId, userId);
        const tenant = await storage.getTenant(tenantId);
        if (!tenant || tenant.status !== "active" || !tenantUser?.isActive) {
          return res.status(403).json({ error: "Acesso negado a este tenant" });
        }

        req.session.user!.tenantId = tenantId;
        req.session.user!.role = tenantUser.role as any;
        await saveSession(req);

        res.json({ user: req.session.user });
      } catch {
        res.status(500).json({ error: "Erro ao trocar tenant" });
      }
    },
  );

  // ==================== PUBLIC TENANT ROUTES ====================
  v1Router.get("/tenants/by-slug/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const tenant = await storage.getTenantBySlug(slug);

      if (!tenant) {
        return res.status(404).json({ error: "Loja não encontrada" });
      }

      if (tenant.status !== "active") {
        return res.status(403).json({ error: "Esta loja não está ativa" });
      }

      res.json({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo: tenant.logo,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        loginMessage: tenant.loginMessage,
      });
    } catch {
      res.status(500).json({ error: "Erro ao buscar loja" });
    }
  });

  // ==================== ADMIN ROUTES ====================
  v1Router.get("/admin/tenants", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const tenants = await storage.getTenants();
      res.json(tenants);
    } catch {
      res.status(500).json({ error: "Erro ao buscar tenants" });
    }
  });

  v1Router.post("/admin/tenants", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const validatedData = insertTenantSchema.parse(req.body);
      const tenant = await storage.createTenant(validatedData);
      res.status(201).json(tenant);
    } catch {
      res.status(400).json({ error: "Dados de tenant inválidos" });
    }
  });

  v1Router.put(
    "/admin/tenants/:tenantId",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const tenantId = parseInt(req.params.tenantId);
        if (isNaN(tenantId)) {
          return sendError(res, 400, "ID de tenant inválido", "INVALID_ID");
        }
        const { name, slug, plan, status, logo, primaryColor, secondaryColor, loginMessage } =
          req.body;

        const updateData: Record<string, string | null | undefined> = {};
        if (name !== undefined) updateData.name = name;
        if (slug !== undefined) updateData.slug = slug;
        if (plan !== undefined) updateData.plan = plan;
        if (status !== undefined) updateData.status = status;
        if (logo !== undefined) updateData.logo = logo || null;
        if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
        if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor;
        if (loginMessage !== undefined) updateData.loginMessage = loginMessage || null;

        const updated = await storage.updateTenant(tenantId, updateData as any);

        if (!updated) {
          return res.status(404).json({ error: "Tenant não encontrado" });
        }

        res.json(updated);
      } catch (error) {
        logger.error("Tenant update failed", {
          requestId: (req as any).requestId,
          endpoint: "/api/v1/admin/tenants/:tenantId",
          userId: req.session.user?.id,
          tenantId: parseInt(req.params.tenantId),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        res.status(400).json({ error: "Erro ao atualizar tenant" });
      }
    },
  );

  v1Router.get(
    "/admin/tenants/:tenantId/users",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const tenantId = parseInt(req.params.tenantId);
        if (isNaN(tenantId)) {
          return sendError(res, 400, "ID de tenant inválido", "INVALID_ID");
        }
        const tenantUsers = await storage.getTenantUsers(tenantId);
        res.json(tenantUsers);
      } catch {
        res.status(500).json({ error: "Erro ao buscar usuários do tenant" });
      }
    },
  );

  v1Router.delete(
    "/admin/tenants/:tenantId",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const tenantId = parseInt(req.params.tenantId);
        if (isNaN(tenantId)) {
          return sendError(res, 400, "ID de tenant inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteTenant(tenantId, {
          ...getAuditContext(req),
          action: "entity.deleted",
          targetType: "tenants",
          outcome: "success",
        });
        if (!deleted) {
          return res.status(404).json({ error: "Tenant não encontrado" });
        }
        res.json({ message: "Tenant excluído com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir tenant" });
      }
    },
  );

  // ==================== ADMIN USER MANAGEMENT ====================
  v1Router.get("/admin/users", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getUsers();
      const tenants = await storage.getTenants();

      const usersWithTenants = await Promise.all(
        users.map(async ({ password: _password, ...user }) => {
          const userTenants = await storage.getUserTenants(user.id);
          return {
            ...user,
            tenantUsers: userTenants.map((tu) => ({
              ...tu,
              tenant: tenants.find((t) => t.id === tu.tenantId),
            })),
          };
        }),
      );

      res.json(usersWithTenants);
    } catch (error) {
      logger.error("Failed to fetch users", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/admin/users",
        userId: req.session.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  v1Router.post("/admin/users", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { email, password, name, cpf, sellerCode, phone, isSuperAdmin, tenantId, role } =
        req.body;

      // Check for duplicate CPF
      if (cpf) {
        const existingByCpf = await storage.getUserByCpf(cpf);
        if (existingByCpf) {
          return sendError(res, 400, "CPF já está em uso", "DUPLICATE_CPF");
        }
      }

      // Check for duplicate email only if provided
      if (!email) {
        return res.status(400).json({ error: "Email é obrigatório" });
      }

      const normalizedEmail = normalizeEmail(email);

      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return sendError(res, 400, "Email já está em uso", "DUPLICATE_EMAIL");
      }

      if (!password || password.length < 12) {
        return res
          .status(400)
          .json({ error: "Senha é obrigatória e deve ter pelo menos 12 caracteres" });
      }

      let parsedTenantId: number | undefined;
      if (tenantId && !isSuperAdmin) {
        parsedTenantId = parseInt(tenantId);
        if (isNaN(parsedTenantId)) {
          return sendError(res, 400, "ID de tenant inválido", "INVALID_ID");
        }
        const tenant = await storage.getTenant(parsedTenantId);
        if (!tenant || tenant.status !== "active") {
          return res.status(400).json({ error: "Tenant inválido ou inativo" });
        }
      }

      const hashedPassword = await hashPassword(password);
      const created = await storage.createUserWithMembership(
        {
          email: normalizedEmail,
          cpf: cpf || null,
          sellerCode: sellerCode || null,
          phone: phone || null,
          password: hashedPassword,
          name,
          isSuperAdmin: isSuperAdmin || false,
          mustChangePassword: !isSuperAdmin,
        },
        parsedTenantId,
        parsedTenantId ? normalizeAssignableRole(role) : undefined,
        {
          ...getAuditContext(req),
          tenantId: parsedTenantId,
          action: parsedTenantId ? "membership.created" : "auth.register",
          targetType: parsedTenantId ? "membership" : "user",
          outcome: "success",
          metadata: parsedTenantId
            ? { role: normalizeAssignableRole(role) }
            : { tenantCreated: false },
        },
      );
      const user = created.user;

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      logger.error("User creation failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/admin/users",
        userId: req.session.user?.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(400).json({ error: "Erro ao criar usuário" });
    }
  });

  v1Router.put("/admin/users/:userId", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { name, email, password, isSuperAdmin } = req.body;

      let hashedPassword: string | undefined;
      if (password) {
        if (password.length < 12) {
          return res.status(400).json({ error: "Senha deve ter pelo menos 12 caracteres" });
        }
        hashedPassword = await hashPassword(password);
      }
      const hasChanges =
        name !== undefined ||
        email !== undefined ||
        isSuperAdmin !== undefined ||
        hashedPassword !== undefined;
      const updated = hasChanges
        ? await storage.updateUserBySuperAdmin(
            userId,
            {
              name,
              email: email === undefined ? undefined : normalizeEmail(email),
              isSuperAdmin,
              hashedPassword,
            },
            getAuditContext(req),
          )
        : await storage.getUser(userId);
      if (!updated) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const { password: _, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch {
      res.status(400).json({ error: "Erro ao atualizar usuário" });
    }
  });

  v1Router.delete(
    "/admin/users/:userId",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;

        if (req.session.user?.id === userId) {
          return res.status(400).json({ error: "Você não pode excluir seu próprio usuário" });
        }

        const deleted = await storage.deleteUser(userId, {
          ...getAuditContext(req),
          action: "entity.deleted",
          targetType: "users",
          outcome: "success",
        });
        if (!deleted) {
          return res.status(404).json({ error: "Usuário não encontrado" });
        }
        res.json({ message: "Usuário excluído com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir usuário" });
      }
    },
  );

  v1Router.post(
    "/admin/users/:userId/tenants",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        const { tenantId, role } = req.body;

        const parsedTenantId = parseInt(tenantId);
        if (isNaN(parsedTenantId)) {
          return sendError(res, 400, "ID de tenant inválido", "INVALID_ID");
        }

        const [user, tenant] = await Promise.all([
          storage.getUser(userId),
          storage.getTenant(parsedTenantId),
        ]);
        if (!user) {
          return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (!tenant || tenant.status !== "active") {
          return res.status(400).json({ error: "Tenant inválido ou inativo" });
        }

        const existing = await storage.getTenantUser(parsedTenantId, userId);
        const tenantUser = await storage.upsertTenantUserAudited(
          parsedTenantId,
          userId,
          normalizeAssignableRole(role),
          {
            ...getAuditContext(req),
            tenantId: parsedTenantId,
            action: existing ? "membership.role_changed" : "membership.created",
            targetType: "membership",
            outcome: "success",
          },
        );
        if (existing) {
          return res.json(tenantUser);
        }
        res.status(201).json(tenantUser);
      } catch {
        res.status(400).json({ error: "Erro ao vincular usuário ao tenant" });
      }
    },
  );

  v1Router.delete(
    "/admin/users/:userId/tenants/:tenantId",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const { userId, tenantId } = req.params;
        const parsedTenantId = parseInt(tenantId);
        if (isNaN(parsedTenantId)) {
          return sendError(res, 400, "ID de tenant inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteTenantUserAudited(parsedTenantId, userId, {
          ...getAuditContext(req),
          tenantId: parsedTenantId,
          action: "membership.removed",
          targetType: "membership",
          outcome: "success",
        });
        if (!deleted) {
          return res.status(404).json({ error: "Vínculo não encontrado" });
        }
        res.json({ message: "Vínculo removido com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao remover vínculo" });
      }
    },
  );

  v1Router.post(
    "/admin/users/:userId/reset-password",
    requireSuperAdmin,
    passwordResetLimiter,
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const newPassword = requireStrongTemporaryPassword(req.body?.newPassword);
        const hashedPassword = await hashPassword(newPassword);
        await storage.updateUserPasswordAudited(userId, hashedPassword, true, {
          ...getAuditContext(req),
          action: "auth.password_changed",
          targetType: "user",
          outcome: "success",
          metadata: { resetType: "super_admin" },
        });

        res.json({
          message:
            "Senha resetada com sucesso. Informe a senha temporária ao usuário por canal seguro.",
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("Senha temporária")) {
          return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: "Erro ao resetar senha" });
      }
    },
  );

  const auditActionSchema = z.enum([
    "auth.login",
    "auth.register",
    "auth.password_changed",
    "identity.updated",
    "global_role.changed",
    "membership.created",
    "membership.role_changed",
    "membership.removed",
    "data.exported",
    "entity.deleted",
    "order.cancelled",
    "cashback.credited",
    "cashback.debited",
    "cashback.reversed",
    "cashback.expired",
    "cashback.reconciled",
  ] satisfies [AuditAction, ...AuditAction[]]);
  const auditListQuerySchema = z
    .object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(25),
      action: auditActionSchema.optional(),
      outcome: z.enum(["success", "failure"]).optional(),
    })
    .strict();

  v1Router.get("/admin/audit-events", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const query = auditListQuerySchema.parse(req.query);
      const result = await storage.getAuditEvents({
        global: true,
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
        action: query.action,
        outcome: query.outcome,
      });
      res.json({
        data: result.data,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / query.limit),
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const parsed = handleZodError(error);
        return sendError(res, 400, parsed.message, "VALIDATION_ERROR", parsed.details);
      }
      res.status(500).json({ error: "Erro ao buscar eventos de auditoria" });
    }
  });

  // Every tenant-scoped route below revalidates the selected tenant and the
  // current membership. This makes tenant or membership revocation immediate,
  // including for read-only endpoints that only require authentication.
  v1Router.use(
    [
      "/tenant",
      "/team",
      "/dashboard",
      "/customers",
      "/products",
      "/orders",
      "/cashback-rules",
      "/cashback",
      "/campaigns",
      "/automations",
      "/seller-tasks",
      "/seller-goals",
      "/customer-interactions",
      "/seller-ranking",
      "/reports",
      "/import",
      "/export",
      "/notifications",
      "/audit-events",
    ],
    requireTenantContext,
  );

  v1Router.get(
    "/audit-events",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const query = auditListQuerySchema.parse(req.query);
        const result = await storage.getAuditEvents({
          tenantId: getTenantId(req),
          limit: query.limit,
          offset: (query.page - 1) * query.limit,
          action: query.action,
          outcome: query.outcome,
        });
        res.json({
          data: result.data,
          pagination: {
            page: query.page,
            limit: query.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / query.limit),
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          const parsed = handleZodError(error);
          return sendError(res, 400, parsed.message, "VALIDATION_ERROR", parsed.details);
        }
        res.status(500).json({ error: "Erro ao buscar eventos de auditoria" });
      }
    },
  );

  // ==================== TENANT SETTINGS (FOR MANAGERS) ====================
  v1Router.get(
    "/tenant/settings",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: "Tenant não encontrado" });
        }

        res.json({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logo: tenant.logo,
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor,
          loginMessage: tenant.loginMessage,
        });
      } catch {
        res.status(500).json({ error: "Erro ao buscar configurações" });
      }
    },
  );

  v1Router.put(
    "/tenant/settings",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const { name, logo, primaryColor, secondaryColor, loginMessage } = req.body;

        const updateData: Record<string, any> = {};

        if (name !== undefined && typeof name === "string" && name.trim().length > 0) {
          updateData.name = name.trim();
        }

        if (logo !== undefined) {
          if (logo === null) {
            updateData.logo = null;
          } else if (typeof logo === "string" && logo.trim().length > 0) {
            updateData.logo = logo.trim();
          }
        }

        if (primaryColor !== undefined) {
          if (primaryColor === null) {
            updateData.primaryColor = null;
          } else if (typeof primaryColor === "string" && primaryColor.trim().length > 0) {
            updateData.primaryColor = primaryColor.trim();
          }
        }

        if (secondaryColor !== undefined) {
          if (secondaryColor === null) {
            updateData.secondaryColor = null;
          } else if (typeof secondaryColor === "string" && secondaryColor.trim().length > 0) {
            updateData.secondaryColor = secondaryColor.trim();
          }
        }

        if (loginMessage !== undefined) {
          if (loginMessage === null) {
            updateData.loginMessage = null;
          } else if (typeof loginMessage === "string" && loginMessage.trim().length > 0) {
            updateData.loginMessage = loginMessage.trim();
          }
        }

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: "Nenhum campo para atualizar" });
        }

        const updated = await storage.updateTenant(tenantId, updateData);

        if (!updated) {
          return res.status(404).json({ error: "Tenant não encontrado" });
        }

        res.json({
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          logo: updated.logo,
          primaryColor: updated.primaryColor,
          secondaryColor: updated.secondaryColor,
          loginMessage: updated.loginMessage,
        });
      } catch {
        res.status(500).json({ error: "Erro ao atualizar configurações" });
      }
    },
  );

  // ==================== TENANT USER MANAGEMENT (FOR MANAGERS) ====================
  v1Router.get(
    "/team",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const tenantUsers = await storage.getTenantUsers(tenantId);
        const usersWithDetails = await Promise.all(
          tenantUsers.map(async (tu) => {
            const user = await storage.getUser(tu.userId);
            if (!user) return null;
            const { password: _password, ...userWithoutPassword } = user;
            return { ...tu, user: userWithoutPassword };
          }),
        );

        res.json(usersWithDetails.filter(Boolean));
      } catch {
        res.status(500).json({ error: "Erro ao buscar equipe" });
      }
    },
  );

  v1Router.post(
    "/team",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const { name, cpf, sellerCode, phone, email, role } = req.body;

        if (cpf) {
          const existingByCpf = await storage.getUserByCpf(cpf);
          if (existingByCpf) {
            return sendError(res, 400, "CPF já está em uso", "DUPLICATE_CPF");
          }
        }

        if (!email) {
          return res.status(400).json({ error: "Email é obrigatório" });
        }

        const normalizedEmail = normalizeEmail(email);

        const existingUser = await storage.getUserByEmail(normalizedEmail);
        if (existingUser) {
          return sendError(res, 400, "Email já está em uso", "DUPLICATE_EMAIL");
        }

        const initialPassword = requireStrongTemporaryPassword(req.body?.password);
        const hashedPassword = await hashPassword(initialPassword);

        const created = await storage.createUserWithMembership(
          {
            email: normalizedEmail,
            cpf: cpf || null,
            sellerCode: sellerCode || null,
            phone: phone || null,
            password: hashedPassword,
            name,
            isSuperAdmin: false,
            mustChangePassword: true,
          },
          tenantId,
          normalizeAssignableRole(role),
          {
            ...getAuditContext(req),
            tenantId,
            action: "membership.created",
            targetType: "membership",
            outcome: "success",
            metadata: { role: normalizeAssignableRole(role) },
          },
        );
        const user = created.user;

        const { password: _password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Senha temporária")) {
          return res.status(400).json({ error: error.message });
        }
        logger.error("Team member creation failed", {
          requestId: (req as any).requestId,
          endpoint: "/api/v1/team",
          userId: req.session.user?.id,
          tenantId: getTenantId(req),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        res.status(400).json({ error: "Erro ao criar membro da equipe" });
      }
    },
  );

  v1Router.put(
    "/team/:userId",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const { userId } = req.params;
        const { name, phone, role } = req.body;

        const tenantUser = await storage.getTenantUser(tenantId, userId);
        if (!tenantUser) {
          return res.status(404).json({ error: "Usuário não encontrado nesta empresa" });
        }

        // A user identity can be shared by multiple tenants. Tenant managers may
        // only update the role in their own membership, never global profile data.
        if (name !== undefined || phone !== undefined) {
          return sendError(
            res,
            400,
            "Nome e telefone só podem ser alterados pelo administrador global",
            "GLOBAL_IDENTITY_FIELDS_FORBIDDEN",
          );
        }

        if (role !== undefined) {
          await storage.upsertTenantUserAudited(tenantId, userId, normalizeAssignableRole(role), {
            ...getAuditContext(req),
            tenantId,
            action: "membership.role_changed",
            targetType: "membership",
            outcome: "success",
          });
        }

        res.json({ message: "Membro atualizado com sucesso" });
      } catch {
        res.status(400).json({ error: "Erro ao atualizar membro" });
      }
    },
  );

  v1Router.post(
    "/team/:userId/reset-password",
    requireAuth,
    requireRole("manager"),
    passwordResetLimiter,
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const { userId } = req.params;

        const tenantUser = await storage.getTenantUser(tenantId, userId);
        if (!tenantUser) {
          return res.status(404).json({ error: "Usuário não encontrado nesta empresa" });
        }

        const userTenants = await storage.getUserTenants(userId);
        const belongsToAnotherTenant = userTenants.some(
          (membership) => membership.tenantId !== tenantId,
        );
        if (belongsToAnotherTenant) {
          return res.status(403).json({
            error:
              "A senha de um usuário compartilhado entre empresas só pode ser resetada pelo super administrador",
            code: "CROSS_TENANT_PASSWORD_RESET_FORBIDDEN",
          });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const newPassword = requireStrongTemporaryPassword(req.body?.newPassword);
        const hashedPassword = await hashPassword(newPassword);
        await storage.updateUserPasswordAudited(userId, hashedPassword, true, {
          ...getAuditContext(req),
          tenantId,
          action: "auth.password_changed",
          targetType: "user",
          outcome: "success",
          metadata: { resetType: "tenant_manager" },
        });

        res.json({
          message:
            "Senha resetada com sucesso. Informe a senha temporária ao usuário por canal seguro.",
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("Senha temporária")) {
          return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: "Erro ao resetar senha" });
      }
    },
  );

  v1Router.delete(
    "/team/:userId",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const { userId } = req.params;

        if (req.session.user?.id === userId) {
          return res.status(400).json({ error: "Você não pode remover a si mesmo" });
        }

        const tenantUser = await storage.getTenantUser(tenantId, userId);
        if (!tenantUser) {
          return res.status(404).json({ error: "Usuário não encontrado nesta empresa" });
        }

        await storage.deleteTenantUserAudited(tenantId, userId, {
          ...getAuditContext(req),
          tenantId,
          action: "membership.removed",
          targetType: "membership",
          outcome: "success",
        });

        res.json({ message: "Membro removido da equipe" });
      } catch {
        res.status(500).json({ error: "Erro ao remover membro" });
      }
    },
  );

  // ==================== DASHBOARD STATS ====================
  v1Router.get("/dashboard/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const [stats, charts] = await Promise.all([
        storage.getDashboardStats(tenantId),
        storage.getDashboardCharts(tenantId),
      ]);
      const segmentColors: Record<string, string> = {
        VIP: "#9333ea",
        Regular: "#00C49F",
        Novo: "#FFBB28",
        "Em Risco": "#FF8042",
        Inativo: "#8884d8",
      };
      res.json({
        ...stats,
        salesChart: charts.revenueByMonth.map((month) => ({
          date: month.month,
          value: month.revenue,
          valueCents: month.revenueCents,
        })),
        customerSegments: charts.customersBySegment.map((segment) => ({
          name: segment.segment,
          value: segment.count,
          color: segmentColors[segment.segment] ?? "#8884d8",
        })),
        topProducts: charts.topProducts.map((product) => ({
          name: product.name,
          sales: product.quantity,
          revenue: product.revenue,
        })),
      });
    } catch (error) {
      logger.error("Dashboard stats query failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/dashboard/stats",
        userId: req.session.user?.id,
        tenantId: req.session.user?.tenantId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  // ==================== TENANT-SCOPED DATA ROUTES ====================
  /**
   * @description Retrieves all customers for the current tenant with pagination support
   * @route GET /api/v1/customers
   * @access auth
   * @param {number} [page=1] - Page number for pagination
   * @param {number} [limit=50] - Number of results per page (max 100)
   * @returns {object} Paginated list of customer objects with pagination metadata
   */
  v1Router.get("/customers", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const { page, limit, search, segment, sort, order } = customerListQuerySchema.parse(
        req.query,
      );
      const offset = (page - 1) * limit;
      const { data, total } = await storage.getCustomers(tenantId, {
        limit,
        offset,
        search,
        segment,
        sort,
        order,
      });
      const totalPages = Math.ceil(total / limit);

      res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const zodError = handleZodError(error);
        return sendError(res, 400, zodError.message, "INVALID_QUERY", zodError.details);
      }
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  /**
   * @description Creates a new customer in the current tenant
   * @route POST /api/v1/customers
   * @access manager, seller
   * @param {string} name - Customer's full name
   * @param {string} email - Customer's email address
   * @param {string} phone - Customer's phone number
   * @param {string} [segment] - Customer segment (e.g., VIP, Novo, Regular)
   * @param {string} [ltv] - Customer lifetime value
   * @param {string} [favoriteCategory] - Customer's favorite product category
   * @returns {object} Newly created customer object
   */
  v1Router.post(
    "/customers",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const validatedData = insertCustomerSchema.parse({ ...req.body, tenantId });
        const customer = await storage.createCustomer(validatedData);
        res.status(201).json(customer);
      } catch (error) {
        if (error instanceof ZodError) {
          const zodError = handleZodError(error);
          return sendError(res, 400, zodError.message, "VALIDATION_ERROR", zodError.details);
        }
        return sendError(res, 400, "Dados de cliente inválidos", "CUSTOMER_CREATE_ERROR");
      }
    },
  );

  /**
   * @description Updates an existing customer's information
   * @route PUT /api/v1/customers/:id
   * @access manager, seller
   * @param {number} id - Customer ID to update
   * @param {object} updates - Fields to update (name, email, phone, segment, etc.)
   * @returns {object} Updated customer object
   */
  v1Router.put(
    "/customers/:id",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const customerId = parseInt(req.params.id);
        if (isNaN(customerId)) {
          return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
        }
        const updateData = updateCustomerSchema.parse(req.body);
        const updated = await storage.updateCustomer(tenantId, customerId, updateData);
        if (!updated) {
          return sendError(res, 404, "Cliente não encontrado", "CUSTOMER_NOT_FOUND");
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar cliente" });
      }
    },
  );

  /**
   * @description Deletes a customer from the current tenant
   * @route DELETE /api/v1/customers/:id
   * @access manager, seller
   * @param {number} id - Customer ID to delete
   * @returns {object} Success message
   */
  v1Router.delete(
    "/customers/:id",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const customerId = parseInt(req.params.id);
        if (isNaN(customerId)) {
          return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteCustomer(tenantId, customerId, {
          ...getAuditContext(req),
          tenantId,
          action: "entity.deleted",
          targetType: "customers",
          outcome: "success",
        });
        if (!deleted) {
          return sendError(res, 404, "Cliente não encontrado", "CUSTOMER_NOT_FOUND");
        }
        res.json({ message: "Cliente excluído com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir cliente" });
      }
    },
  );

  /**
   * @description Retrieves all products for the current tenant with pagination support
   * @route GET /api/v1/products
   * @access auth
   * @param {number} [page=1] - Page number for pagination
   * @param {number} [limit=50] - Number of results per page (max 100)
   * @returns {object} Paginated list of product objects with pagination metadata
   */
  v1Router.get("/products", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const { page, limit, search, status, sort, order } = productListQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;
      const { data, total } = await storage.getProducts(tenantId, {
        limit,
        offset,
        search,
        status,
        sort,
        order,
      });
      const totalPages = Math.ceil(total / limit);

      res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const zodError = handleZodError(error);
        return sendError(res, 400, zodError.message, "INVALID_QUERY", zodError.details);
      }
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  /**
   * @description Creates a new product in the current tenant
   * @route POST /api/v1/products
   * @access manager
   * @param {string} name - Product name
   * @param {string} category - Product category
   * @param {string} price - Product price (formatted as currency)
   * @param {number} stock - Available stock quantity
   * @param {string} [status] - Product status (Ativo, Inativo)
   * @param {string} [image] - Product image URL
   * @returns {object} Newly created product object
   */
  v1Router.post(
    "/products",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const validatedData = insertProductSchema.parse({ ...req.body, tenantId });
        const product = await storage.createProduct(validatedData);
        res.status(201).json(product);
      } catch (error) {
        if (error instanceof ZodError) {
          const zodError = handleZodError(error);
          return sendError(res, 400, zodError.message, "VALIDATION_ERROR", zodError.details);
        }
        return sendError(res, 400, "Dados de produto inválidos", "PRODUCT_CREATE_ERROR");
      }
    },
  );

  /**
   * @description Updates an existing product's information
   * @route PUT /api/v1/products/:id
   * @access manager
   * @param {number} id - Product ID to update
   * @param {object} updates - Fields to update (name, category, price, stock, status, image)
   * @returns {object} Updated product object
   */
  v1Router.put(
    "/products/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const productId = parseInt(req.params.id);
        if (isNaN(productId)) {
          return sendError(res, 400, "ID de produto inválido", "INVALID_ID");
        }
        const updateData = updateProductSchema.parse(req.body);
        const updated = await storage.updateProduct(tenantId, productId, updateData);
        if (!updated) {
          return sendError(res, 404, "Produto não encontrado", "PRODUCT_NOT_FOUND");
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar produto" });
      }
    },
  );

  /**
   * @description Deletes a product from the current tenant
   * @route DELETE /api/v1/products/:id
   * @access manager
   * @param {number} id - Product ID to delete
   * @returns {object} Success message
   */
  v1Router.delete(
    "/products/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const productId = parseInt(req.params.id);
        if (isNaN(productId)) {
          return sendError(res, 400, "ID de produto inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteProduct(tenantId, productId, {
          ...getAuditContext(req),
          tenantId,
          action: "entity.deleted",
          targetType: "products",
          outcome: "success",
        });
        if (!deleted) {
          return sendError(res, 404, "Produto não encontrado", "PRODUCT_NOT_FOUND");
        }
        res.json({ message: "Produto excluído com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir produto" });
      }
    },
  );

  /**
   * @description Retrieves all orders for the current tenant with pagination support
   * @route GET /api/v1/orders
   * @access auth
   * @param {number} [page=1] - Page number for pagination
   * @param {number} [limit=50] - Number of results per page (max 100)
   * @returns {object} Paginated list of order objects with pagination metadata
   */
  v1Router.get("/orders", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const { page, limit, search, status, sort, order } = orderListQuerySchema.parse(req.query);
      const offset = (page - 1) * limit;
      const { data, total } = await storage.getOrders(tenantId, {
        limit,
        offset,
        search,
        status,
        sort,
        order,
      });
      const totalPages = Math.ceil(total / limit);

      res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const zodError = handleZodError(error);
        return sendError(res, 400, zodError.message, "INVALID_QUERY", zodError.details);
      }
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  /**
   * @description Creates a new order in the current tenant
   * @route POST /api/v1/orders
   * @access manager, seller
   * @param {string} customer - Customer name
   * @param {number} total - Order total amount
   * @param {string} status - Order status (Pendente, Concluído, Cancelado)
   * @param {string} orderDate - Order date in ISO format
   * @returns {object} Newly created order object
   */
  v1Router.post(
    "/orders",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const transactionalData = transactionalOrderCreateSchema.parse(req.body);
        const order = await storage.createOrderWithLineItems({ tenantId, ...transactionalData });
        return res.status(201).json(order);
      } catch (error) {
        if (error instanceof ZodError) {
          const zodError = handleZodError(error);
          return sendError(res, 400, zodError.message, "VALIDATION_ERROR", zodError.details);
        }
        if (error instanceof OrderDomainError) {
          return sendError(res, 400, error.message, error.code);
        }
        return sendError(res, 400, "Dados de pedido inválidos", "ORDER_CREATE_ERROR");
      }
    },
  );

  v1Router.get("/orders/:id/items", requireAuth, async (req: Request, res: Response) => {
    const tenantId = getTenantId(req);
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0)
      return sendError(res, 400, "ID de pedido inválido", "INVALID_ID");
    const order = await storage.getOrder(tenantId, orderId);
    if (!order) return sendError(res, 404, "Pedido não encontrado", "ORDER_NOT_FOUND");
    res.json(await storage.getOrderItems(tenantId, orderId));
  });

  /**
   * @description Updates an existing order's information
   * @route PUT /api/v1/orders/:id
   * @access manager, seller
   * @param {number} id - Order ID to update
   * @param {object} updates - Fields to update (customer, total, status, orderDate)
   * @returns {object} Updated order object
   */
  v1Router.put(
    "/orders/:id",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId)) {
          return sendError(res, 400, "ID de pedido inválido", "INVALID_ID");
        }
        const { tenantId: _ignoredTenantId, ...candidateUpdate } = req.body ?? {};
        const updateData = updateOrderSchema.parse(candidateUpdate);
        if (updateData.customerId && !(await isCustomerInTenant(tenantId, updateData.customerId))) {
          return sendError(
            res,
            400,
            "Cliente inválido para este tenant",
            "INVALID_TENANT_REFERENCE",
          );
        }
        const updated =
          updateData.status === "Cancelado"
            ? await storage.cancelOrder(tenantId, orderId, {
                ...getAuditContext(req),
                tenantId,
                action: "order.cancelled",
                targetType: "orders",
                outcome: "success",
              })
            : await storage.updateOrder(tenantId, orderId, updateData);
        if (!updated) {
          return sendError(res, 404, "Pedido não encontrado", "ORDER_NOT_FOUND");
        }
        res.json(updated);
      } catch (error) {
        if (error instanceof OrderDomainError) {
          return sendError(res, 400, error.message, error.code);
        }
        res.status(400).json({ error: "Erro ao atualizar pedido" });
      }
    },
  );

  /**
   * @description Idempotently cancels an order and restores stock once
   * @route DELETE /api/v1/orders/:id
   * @access manager, seller
   * @param {number} id - Order ID to delete
   * @returns {object} Success message
   */
  v1Router.delete(
    "/orders/:id",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const orderId = parseInt(req.params.id);
        if (isNaN(orderId)) {
          return sendError(res, 400, "ID de pedido inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteOrder(tenantId, orderId, {
          ...getAuditContext(req),
          tenantId,
          action: "order.cancelled",
          targetType: "orders",
          outcome: "success",
        });
        if (!deleted) {
          return sendError(res, 404, "Pedido não encontrado", "ORDER_NOT_FOUND");
        }
        res.json({ message: "Pedido cancelado com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao cancelar pedido" });
      }
    },
  );

  v1Router.get("/cashback-rules", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const rules = await storage.getCashbackRules(tenantId);
      res.json(rules);
    } catch {
      res.status(500).json({ error: "Failed to fetch cashback rules" });
    }
  });

  v1Router.post(
    "/cashback-rules",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const validatedData = insertCashbackRuleSchema.parse({ ...req.body, tenantId });
        const rule = await storage.createCashbackRule(validatedData);
        res.status(201).json(rule);
      } catch {
        res.status(400).json({ error: "Invalid cashback rule data" });
      }
    },
  );

  v1Router.put(
    "/cashback-rules/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }

        const updateSchema = insertCashbackRuleSchema.partial().omit({ tenantId: true });
        const validatedData = updateSchema.parse(req.body);

        if (Object.keys(validatedData).length === 0) {
          return res.status(400).json({ error: "Nenhum campo para atualizar" });
        }

        const updated = await storage.updateCashbackRule(tenantId, id, validatedData);
        if (!updated) {
          return res.status(404).json({ error: "Regra não encontrada" });
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar regra de cashback" });
      }
    },
  );

  v1Router.delete(
    "/cashback-rules/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteCashbackRule(tenantId, id, {
          ...getAuditContext(req),
          tenantId,
          action: "entity.deleted",
          targetType: "cashback_rules",
          outcome: "success",
        });
        if (!deleted) {
          return res.status(404).json({ error: "Regra não encontrada" });
        }
        res.json({ message: "Regra excluída com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir regra de cashback" });
      }
    },
  );

  v1Router.get("/campaigns", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const campaigns = await storage.getCampaigns(tenantId);
      res.json(campaigns);
    } catch {
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  v1Router.post(
    "/campaigns",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const validatedData = insertCampaignSchema.parse({ ...req.body, tenantId });
        const campaign = await storage.createCampaign(validatedData);
        res.status(201).json(campaign);
      } catch {
        res.status(400).json({ error: "Invalid campaign data" });
      }
    },
  );

  v1Router.put(
    "/campaigns/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const { name, channel, audience, status, date, sent, openRate, conversion, revenue } =
          req.body;

        const updateData: Record<string, any> = {};
        if (name !== undefined) updateData.name = name;
        if (channel !== undefined) updateData.channel = channel;
        if (audience !== undefined) updateData.audience = audience;
        if (status !== undefined) updateData.status = status;
        if (date !== undefined) updateData.date = date;
        if (sent !== undefined) updateData.sent = sent;
        if (openRate !== undefined) updateData.openRate = openRate;
        if (conversion !== undefined) updateData.conversion = conversion;
        if (revenue !== undefined) updateData.revenue = revenue;

        const updated = await storage.updateCampaign(tenantId, id, updateData);
        if (!updated) {
          return res.status(404).json({ error: "Campanha não encontrada" });
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar campanha" });
      }
    },
  );

  v1Router.delete(
    "/campaigns/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteCampaign(tenantId, id, {
          ...getAuditContext(req),
          tenantId,
          action: "entity.deleted",
          targetType: "campaigns",
          outcome: "success",
        });
        if (!deleted) {
          return res.status(404).json({ error: "Campanha não encontrada" });
        }
        res.json({ message: "Campanha excluída com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir campanha" });
      }
    },
  );

  v1Router.post(
    "/campaigns/:id/send",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }

        // Materializes recipients and enqueues the job in one transaction. The
        // response is an accepted dispatch, never a delivery confirmation.
        const { execution, created } = requestCampaignDispatch({
          tenantId,
          campaignId: id,
          actorUserId: req.session.user?.id ?? null,
        });

        res.status(created ? 202 : 200).json({
          message: created
            ? "Envio agendado. O status por destinatário fica disponível na execução."
            : "Envio já agendado para esta versão da campanha.",
          execution,
        });
      } catch (error) {
        if (error instanceof CampaignDispatchError) {
          const status = error.code === "NOT_FOUND" ? 404 : 400;
          return sendError(res, status, error.message, error.code);
        }
        if (error instanceof OutboxConflictError) {
          return sendError(res, 409, "Envio conflitante já registrado", "OUTBOX_CONFLICT");
        }
        logger.error("Campaign dispatch request failed", {
          requestId: (req as Request & { requestId?: string }).requestId,
          endpoint: "/api/v1/campaigns/:id/send",
          tenantId: getTenantId(req),
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: "Erro ao agendar envio da campanha" });
      }
    },
  );

  /**
   * @description Lists persisted campaign executions for the active tenant
   * @route GET /api/v1/campaigns/executions
   * @access authenticated
   */
  v1Router.get("/campaigns/executions", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const query = executionListQuerySchema.parse(req.query);
      const result = listCampaignExecutions(tenantId, {
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
        campaignId: query.campaignId,
      });
      res.json({
        data: result.data,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / query.limit),
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const parsed = handleZodError(error);
        return sendError(res, 400, parsed.message, "VALIDATION_ERROR", parsed.details);
      }
      res.status(500).json({ error: "Erro ao buscar execuções de campanha" });
    }
  });

  /**
   * @description Lists the per-recipient delivery status of one execution
   * @route GET /api/v1/campaigns/executions/:executionId/recipients
   * @access authenticated
   */
  v1Router.get(
    "/campaigns/executions/:executionId/recipients",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const executionId = parseInt(req.params.executionId);
        if (isNaN(executionId)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const query = paginationQuerySchema.parse(req.query);
        const result = listCampaignRecipients(tenantId, executionId, {
          limit: query.limit,
          offset: (query.page - 1) * query.limit,
        });
        res.json({
          data: result.data,
          pagination: {
            page: query.page,
            limit: query.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / query.limit),
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          const parsed = handleZodError(error);
          return sendError(res, 400, parsed.message, "VALIDATION_ERROR", parsed.details);
        }
        res.status(500).json({ error: "Erro ao buscar destinatários da execução" });
      }
    },
  );

  v1Router.get("/automations", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const automations = await storage.getAutomations(tenantId);
      res.json(automations);
    } catch {
      res.status(500).json({ error: "Failed to fetch automations" });
    }
  });

  v1Router.post(
    "/automations",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const validatedData = createAutomationSchema.parse({ ...req.body, tenantId });
        const automation = await storage.createAutomation(validatedData);
        res.status(201).json(automation);
      } catch {
        res.status(400).json({ error: "Invalid automation data" });
      }
    },
  );

  v1Router.put(
    "/automations/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const updateData = updateAutomationSchema.parse(req.body);
        const updated = await storage.updateAutomation(tenantId, id, updateData);
        if (!updated) {
          return res.status(404).json({ error: "Automação não encontrada" });
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar automação" });
      }
    },
  );

  v1Router.delete(
    "/automations/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteAutomation(tenantId, id, {
          ...getAuditContext(req),
          tenantId,
          action: "entity.deleted",
          targetType: "automations",
          outcome: "success",
        });
        if (!deleted) {
          return res.status(404).json({ error: "Automação não encontrada" });
        }
        res.json({ message: "Automação excluída com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir automação" });
      }
    },
  );

  v1Router.patch(
    "/automations/:id/toggle",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const automation = await storage.getAutomation(tenantId, id);
        if (!automation) {
          return res.status(404).json({ error: "Automação não encontrada" });
        }
        const updated = await storage.updateAutomation(tenantId, id, {
          isActive: !automation.isActive,
        });
        res.json(updated);
      } catch {
        res.status(500).json({ error: "Erro ao alternar automação" });
      }
    },
  );

  // ==================== USER TENANTS ====================
  v1Router.get("/user/tenants", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user!.id;

      if (req.session.user!.isSuperAdmin) {
        const allTenants = await storage.getTenants();
        res.json(allTenants);
      } else {
        const userTenants = await storage.getUserTenants(userId);
        const tenantsWithDetails = await Promise.all(
          userTenants.map(async (tu) => {
            const tenant = await storage.getTenant(tu.tenantId);
            return { ...tenant, role: tu.role };
          }),
        );
        res.json(tenantsWithDetails);
      }
    } catch {
      res.status(500).json({ error: "Erro ao buscar tenants do usuário" });
    }
  });

  // ==================== PUBLIC CONTACT/DEMO ROUTES ====================
  v1Router.post("/contact", async (req: Request, res: Response) => {
    try {
      const validatedData = insertContactRequestSchema.parse(req.body);
      const contactRequest = await storage.createContactRequest(validatedData);
      res.status(201).json({ message: "Mensagem enviada com sucesso!", id: contactRequest.id });
    } catch {
      res.status(400).json({ error: "Dados de contato inválidos" });
    }
  });

  v1Router.post("/demo", async (req: Request, res: Response) => {
    try {
      const validatedData = insertDemoRequestSchema.parse(req.body);
      const demoRequest = await storage.createDemoRequest(validatedData);
      res
        .status(201)
        .json({ message: "Solicitação de demo enviada com sucesso!", id: demoRequest.id });
    } catch {
      res.status(400).json({ error: "Dados da solicitação inválidos" });
    }
  });

  // ==================== ADMIN CONTACT/DEMO ROUTES ====================
  v1Router.get("/admin/contacts", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const contacts = await storage.getContactRequests();
      res.json(contacts);
    } catch {
      res.status(500).json({ error: "Erro ao buscar contatos" });
    }
  });

  v1Router.put(
    "/admin/contacts/:id/status",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const { status } = req.body;
        const updated = await storage.updateContactRequestStatus(id, status);
        if (!updated) {
          return res.status(404).json({ error: "Contato não encontrado" });
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar status" });
      }
    },
  );

  v1Router.get("/admin/demos", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const demos = await storage.getDemoRequests();
      res.json(demos);
    } catch {
      res.status(500).json({ error: "Erro ao buscar demos" });
    }
  });

  v1Router.put(
    "/admin/demos/:id/status",
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return sendError(res, 400, "ID inválido", "INVALID_ID");
        }
        const { status } = req.body;
        const updated = await storage.updateDemoRequestStatus(id, status);
        if (!updated) {
          return res.status(404).json({ error: "Demo não encontrada" });
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar status" });
      }
    },
  );

  // ==================== ADMIN REPORTS/STATS ====================
  v1Router.get("/admin/tenant-stats", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getTenantStats();
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  // ==================== SELLER TASKS ====================
  v1Router.get("/seller-tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const filters = {
        sellerId: scopeUserFilterToSession(req, req.query.sellerId as string | undefined),
        status: req.query.status as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        type: req.query.type as string | undefined,
      };

      const tasks = await storage.getSellerTasks(tenantId, filters);
      res.json(tasks);
    } catch {
      res.status(500).json({ error: "Erro ao buscar tarefas" });
    }
  });

  v1Router.get("/seller-tasks/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const sellerId = scopeUserFilterToSession(req, req.query.sellerId as string | undefined);
      const stats = await storage.getSellerStats(tenantId, sellerId);
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Erro ao buscar estatísticas" });
    }
  });

  v1Router.post(
    "/seller-tasks",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const validatedData = insertSellerTaskSchema.parse({
          ...req.body,
          tenantId,
          sellerId: isSellerSession(req) ? req.session.user!.id : req.body.sellerId,
        });
        if (
          validatedData.customerId &&
          !(await isCustomerInTenant(tenantId, validatedData.customerId))
        ) {
          return sendError(
            res,
            400,
            "Cliente inválido para este tenant",
            "INVALID_TENANT_REFERENCE",
          );
        }
        if (
          validatedData.sellerId &&
          !(await isActiveUserInTenant(tenantId, validatedData.sellerId))
        ) {
          return sendError(
            res,
            400,
            "Vendedor inválido para este tenant",
            "INVALID_TENANT_REFERENCE",
          );
        }
        const task = await storage.createSellerTask(validatedData);
        res.status(201).json(task);
      } catch {
        res.status(400).json({ error: "Dados da tarefa inválidos" });
      }
    },
  );

  v1Router.put(
    "/seller-tasks/:id",
    requireAuth,
    requireRole("manager", "seller"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const taskId = parseInt(req.params.id);
        if (isNaN(taskId)) {
          return sendError(res, 400, "ID de tarefa inválido", "INVALID_ID");
        }
        const { status, notes } = req.body;

        if (isSellerSession(req)) {
          const task = await storage.getSellerTask(tenantId, taskId);
          if (!task || task.sellerId !== req.session.user!.id) {
            return res.status(403).json({ error: "Acesso negado a esta tarefa" });
          }
        }

        const updateData: Record<string, any> = {};
        if (status !== undefined) {
          updateData.status = status;
          if (status === "completed") {
            updateData.completedAt = new Date().toISOString();
          }
        }
        if (notes !== undefined) updateData.notes = notes;

        const updated = await storage.updateSellerTask(tenantId, taskId, updateData);
        if (!updated) {
          return res.status(404).json({ error: "Tarefa não encontrada" });
        }
        res.json(updated);
      } catch {
        res.status(400).json({ error: "Erro ao atualizar tarefa" });
      }
    },
  );

  v1Router.delete(
    "/seller-tasks/:id",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }
        const taskId = parseInt(req.params.id);
        if (isNaN(taskId)) {
          return sendError(res, 400, "ID de tarefa inválido", "INVALID_ID");
        }
        const deleted = await storage.deleteSellerTask(tenantId, taskId, {
          ...getAuditContext(req),
          tenantId,
          action: "entity.deleted",
          targetType: "seller_tasks",
          outcome: "success",
        });
        if (!deleted) {
          return res.status(404).json({ error: "Tarefa não encontrada" });
        }
        res.json({ message: "Tarefa excluída com sucesso" });
      } catch {
        res.status(500).json({ error: "Erro ao excluir tarefa" });
      }
    },
  );

  // ==================== SELLER GOALS ROUTES ====================
  v1Router.get("/seller-goals", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const sellerId = scopeUserFilterToSession(req, req.query.sellerId as string | undefined);
      const goals = await storage.getSellerGoals(tenantId, sellerId);
      res.json(
        goals || {
          dailyTaskGoal: 10,
          weeklyTaskGoal: 50,
          monthlyTaskGoal: 200,
          dailySalesGoal: "0",
          weeklySalesGoal: "0",
          monthlySalesGoal: "0",
        },
      );
    } catch {
      res.status(500).json({ error: "Erro ao buscar metas" });
    }
  });

  v1Router.post(
    "/seller-goals",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const {
          dailyTaskGoal,
          weeklyTaskGoal,
          monthlyTaskGoal,
          dailySalesGoal,
          weeklySalesGoal,
          monthlySalesGoal,
          sellerId,
        } = req.body;

        if (
          dailyTaskGoal !== undefined &&
          (typeof dailyTaskGoal !== "number" || dailyTaskGoal < 1)
        ) {
          return res.status(400).json({ error: "Meta diária deve ser um número maior que 0" });
        }
        if (
          weeklyTaskGoal !== undefined &&
          (typeof weeklyTaskGoal !== "number" || weeklyTaskGoal < 1)
        ) {
          return res.status(400).json({ error: "Meta semanal deve ser um número maior que 0" });
        }
        if (
          monthlyTaskGoal !== undefined &&
          (typeof monthlyTaskGoal !== "number" || monthlyTaskGoal < 1)
        ) {
          return res.status(400).json({ error: "Meta mensal deve ser um número maior que 0" });
        }
        if (sellerId && !(await isActiveUserInTenant(tenantId, sellerId))) {
          return sendError(
            res,
            400,
            "Vendedor inválido para este tenant",
            "INVALID_TENANT_REFERENCE",
          );
        }

        const goalsData = {
          tenantId,
          sellerId: sellerId || null,
          dailyTaskGoal: dailyTaskGoal || 10,
          weeklyTaskGoal: weeklyTaskGoal || 50,
          monthlyTaskGoal: monthlyTaskGoal || 200,
          dailySalesGoal: dailySalesGoal || "0",
          weeklySalesGoal: weeklySalesGoal || "0",
          monthlySalesGoal: monthlySalesGoal || "0",
        };
        const goals = await storage.upsertSellerGoals(goalsData);
        res.json(goals);
      } catch {
        res.status(400).json({ error: "Erro ao salvar metas" });
      }
    },
  );

  // ==================== CUSTOMER INTERACTIONS ROUTES ====================
  v1Router.get("/customer-interactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      let customerId: number | undefined = undefined;
      if (req.query.customerId) {
        const parsed = parseInt(req.query.customerId as string);
        if (isNaN(parsed)) {
          return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
        }
        customerId = parsed;
      }
      const sellerId = scopeUserFilterToSession(req, req.query.sellerId as string | undefined);
      const parsedLimit = boundedLimitSchema.safeParse(req.query.limit ?? 50);
      if (!parsedLimit.success) {
        return sendError(res, 400, "Limite deve ser um inteiro entre 1 e 100", "INVALID_LIMIT");
      }
      const limit = parsedLimit.data;

      const interactions = await storage.getCustomerInteractions(
        tenantId,
        customerId,
        sellerId,
        limit,
      );
      res.json(interactions);
    } catch {
      res.status(500).json({ error: "Erro ao buscar histórico de interações" });
    }
  });

  v1Router.post("/customer-interactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const { customerId, type, channel, notes, outcome, taskId } = req.body;

      if (!customerId || typeof customerId !== "number") {
        return res.status(400).json({ error: "ID do cliente é obrigatório" });
      }
      if (!type || typeof type !== "string") {
        return res.status(400).json({ error: "Tipo de interação é obrigatório" });
      }
      if (!channel || typeof channel !== "string") {
        return res.status(400).json({ error: "Canal de interação é obrigatório" });
      }
      if (!(await isCustomerInTenant(tenantId, customerId))) {
        return sendError(res, 400, "Cliente inválido para este tenant", "INVALID_TENANT_REFERENCE");
      }
      if (taskId) {
        const task = await storage.getSellerTask(tenantId, taskId);
        if (!task || (task.customerId && task.customerId !== customerId)) {
          return sendError(
            res,
            400,
            "Tarefa inválida para este tenant e cliente",
            "INVALID_TENANT_REFERENCE",
          );
        }
      }

      const interactionData = {
        tenantId,
        customerId,
        sellerId: req.session.user?.id || req.body.sellerId,
        taskId: taskId || null,
        type,
        channel,
        notes: notes || null,
        outcome: outcome || null,
      };
      const interaction = await storage.createCustomerInteraction(interactionData);
      res.status(201).json(interaction);
    } catch {
      res.status(400).json({ error: "Erro ao registrar interação" });
    }
  });

  // ==================== SELLER RANKING ROUTES ====================
  v1Router.get("/seller-ranking", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const period = (req.query.period as "daily" | "weekly" | "monthly") || "weekly";
      const ranking = await storage.getSellerRanking(tenantId, period);
      res.json(ranking);
    } catch {
      res.status(500).json({ error: "Erro ao buscar ranking" });
    }
  });

  // ==================== REPORTS ROUTES ====================
  v1Router.get("/reports", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const query = reportQuerySchema.parse(req.query);
      res.json(await storage.getSalesReport(tenantId, query));
    } catch (error) {
      if (error instanceof ZodError) {
        const parsed = handleZodError(error);
        return sendError(res, 400, parsed.message, "INVALID_REPORT_QUERY", parsed.details);
      }
      logger.error("Reports generation failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/reports",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: "Erro ao gerar relatórios" });
    }
  });

  // ==================== IMPORT/EXPORT ROUTES ====================
  v1Router.post(
    "/import/customers",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const data = Array.isArray(req.body?.data)
          ? req.body.data
          : Array.isArray(req.body?.customers)
            ? req.body.customers
            : [];
        if (!Array.isArray(data) || data.length === 0) {
          return res.status(400).json({ error: "Dados inválidos. Envie um array de clientes." });
        }
        if (data.length > MAX_IMPORT_ROWS) {
          return res
            .status(413)
            .json({ error: `Importação limitada a ${MAX_IMPORT_ROWS} clientes por envio.` });
        }

        const results = { success: 0, errors: [] as string[] };

        for (let index = 0; index < data.length; index++) {
          const row = data[index];
          try {
            if (!row || typeof row !== "object" || Array.isArray(row)) {
              results.errors.push(`Linha ${index + 1}: formato inválido`);
              continue;
            }
            const customerData = {
              tenantId,
              name: sanitizeImportedText(row.name || row.nome),
              email: sanitizeImportedText(row.email),
              phone: sanitizeImportedText(row.phone || row.telefone),
              segment: sanitizeImportedText(row.segment || row.segmento, "Novo"),
              ltv: Math.max(0, parseImportedNumber(row.ltv ?? row.valor ?? row.valorTotal)),
              lastPurchase: sanitizeImportedText(
                row.lastPurchase || row.ultimaCompra || new Date().toLocaleDateString("pt-BR"),
              ),
              favoriteCategory: sanitizeImportedText(row.favoriteCategory || row.categoriaFavorita),
            };

            if (!customerData.name) {
              results.errors.push(`Linha ${index + 1}: cliente sem nome`);
              continue;
            }

            await storage.createCustomer(customerData);
            results.success++;
          } catch (err: any) {
            results.errors.push(`Linha ${index + 1}: ${err.message}`);
          }
        }

        res.json({
          message: `Importação concluída: ${results.success} clientes importados.`,
          success: results.success,
          errors: results.errors.slice(0, 10),
          totalErrors: results.errors.length,
        });
      } catch (error) {
        logger.error("Customer import failed", {
          requestId: (req as any).requestId,
          endpoint: "/api/v1/import/customers",
          userId: req.session.user?.id,
          tenantId: getTenantId(req),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        res.status(500).json({ error: "Erro ao importar clientes" });
      }
    },
  );

  v1Router.post(
    "/import/products",
    requireAuth,
    requireRole("manager"),
    async (req: Request, res: Response) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) {
          return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
        }

        const data = Array.isArray(req.body?.data)
          ? req.body.data
          : Array.isArray(req.body?.products)
            ? req.body.products
            : [];
        if (!Array.isArray(data) || data.length === 0) {
          return res.status(400).json({ error: "Dados inválidos. Envie um array de produtos." });
        }
        if (data.length > MAX_IMPORT_ROWS) {
          return res
            .status(413)
            .json({ error: `Importação limitada a ${MAX_IMPORT_ROWS} produtos por envio.` });
        }

        const results = { success: 0, errors: [] as string[] };

        for (let index = 0; index < data.length; index++) {
          const row = data[index];
          try {
            if (!row || typeof row !== "object" || Array.isArray(row)) {
              results.errors.push(`Linha ${index + 1}: formato inválido`);
              continue;
            }
            const productData = {
              tenantId,
              name: sanitizeImportedText(row.name || row.nome),
              category: sanitizeImportedText(row.category || row.categoria),
              price: Math.max(0, parseImportedNumber(row.price ?? row.preco)),
              stock: Math.max(0, Math.trunc(parseImportedNumber(row.stock ?? row.estoque))),
              status: sanitizeImportedText(row.status, "Ativo"),
              image: sanitizeImportedText(row.image || row.imagem),
            };

            if (!productData.name) {
              results.errors.push(`Linha ${index + 1}: produto sem nome`);
              continue;
            }

            await storage.createProduct(productData);
            results.success++;
          } catch (err: any) {
            results.errors.push(`Linha ${index + 1}: ${err.message}`);
          }
        }

        res.json({
          message: `Importação concluída: ${results.success} produtos importados.`,
          success: results.success,
          errors: results.errors.slice(0, 10),
          totalErrors: results.errors.length,
        });
      } catch (error) {
        logger.error("Product import failed", {
          requestId: (req as any).requestId,
          endpoint: "/api/v1/import/products",
          userId: req.session.user?.id,
          tenantId: getTenantId(req),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        res.status(500).json({ error: "Erro ao importar produtos" });
      }
    },
  );

  v1Router.get("/export/customers", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const customersResult = await storage.getCustomers(tenantId);
      await storage.appendAuditEvent({
        ...getAuditContext(req),
        tenantId,
        action: "data.exported",
        targetType: "customers",
        outcome: "success",
        metadata: { entityType: "customers", rowCount: customersResult.data.length },
      });
      res.json(sanitizeExportRows(customersResult.data));
    } catch {
      res.status(500).json({ error: "Erro ao exportar clientes" });
    }
  });

  v1Router.get("/export/products", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const productsResult = await storage.getProducts(tenantId);
      await storage.appendAuditEvent({
        ...getAuditContext(req),
        tenantId,
        action: "data.exported",
        targetType: "products",
        outcome: "success",
        metadata: { entityType: "products", rowCount: productsResult.data.length },
      });
      res.json(sanitizeExportRows(productsResult.data));
    } catch {
      res.status(500).json({ error: "Erro ao exportar produtos" });
    }
  });

  v1Router.get("/export/orders", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const ordersResult = await storage.getOrders(tenantId);
      await storage.appendAuditEvent({
        ...getAuditContext(req),
        tenantId,
        action: "data.exported",
        targetType: "orders",
        outcome: "success",
        metadata: { entityType: "orders", rowCount: ordersResult.data.length },
      });
      res.json(sanitizeExportRows(ordersResult.data));
    } catch {
      res.status(500).json({ error: "Erro ao exportar pedidos" });
    }
  });

  // ==================== NOTIFICATIONS ROUTES ====================
  v1Router.get("/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const userId = scopeUserFilterToSession(req, req.query.userId as string | undefined);
      const parsedLimit = boundedLimitSchema.safeParse(req.query.limit ?? 50);
      if (!parsedLimit.success) {
        return sendError(res, 400, "Limite deve ser um inteiro entre 1 e 100", "INVALID_LIMIT");
      }
      const limit = parsedLimit.data;

      const notifications = await storage.getNotifications(tenantId, userId, limit);
      res.json(notifications);
    } catch (error) {
      logger.error("Notifications fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/notifications",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({ error: "Erro ao buscar notificações" });
    }
  });

  // ==================== DASHBOARD ROUTES ====================
  v1Router.get("/dashboard/charts", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const charts = await storage.getDashboardCharts(tenantId);
      res.json(charts);
    } catch (error) {
      logger.error("Dashboard charts fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/dashboard/charts",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar gráficos do dashboard" });
    }
  });

  // ==================== CASHBACK ROUTES ====================
  v1Router.get("/cashback/distribution", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const distribution = await storage.getCashbackDistribution(tenantId);
      res.json(distribution);
    } catch (error) {
      logger.error("Cashback distribution fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/cashback/distribution",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar distribuição de cashback" });
    }
  });

  v1Router.get("/cashback/expiring", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      let daysAhead = 30;
      if (req.query.days) {
        const parsed = parseInt(req.query.days as string);
        if (!isNaN(parsed)) {
          daysAhead = parsed;
        }
      }
      const expiring = await storage.getExpiringCashback(tenantId, daysAhead);
      res.json(expiring);
    } catch (error) {
      logger.error("Expiring cashback fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/cashback/expiring",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar cashback expirando" });
    }
  });

  v1Router.get("/cashback/transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      let customerId: number | undefined = undefined;
      if (req.query.customerId) {
        const parsed = parseInt(req.query.customerId as string);
        if (isNaN(parsed)) {
          return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
        }
        customerId = parsed;
      }
      const parsedLimit = boundedLimitSchema.safeParse(req.query.limit ?? 50);
      if (!parsedLimit.success) {
        return sendError(res, 400, "Limite deve ser um inteiro entre 1 e 100", "INVALID_LIMIT");
      }
      const limit = parsedLimit.data;

      const transactions = await storage.getCashbackTransactions(tenantId, customerId, limit);
      res.json(transactions);
    } catch (error) {
      logger.error("Cashback transactions fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/cashback/transactions",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar transações de cashback" });
    }
  });

  const sendCashbackLedgerError = (res: Response, error: unknown) => {
    if (error instanceof ZodError) {
      const parsed = handleZodError(error);
      return sendError(res, 400, parsed.message, "VALIDATION_ERROR", parsed.details);
    }
    if (error instanceof CashbackLedgerError) {
      const status =
        error.code === "TRANSACTION_NOT_FOUND"
          ? 404
          : error.code === "INVALID_TENANT_REFERENCE"
            ? 400
            : 409;
      return sendError(res, status, error.message, error.code);
    }
    return sendError(res, 400, "Operação de cashback inválida", "CASHBACK_OPERATION_ERROR");
  };

  v1Router.post("/cashback/credit", requireAuth, requireRole("manager"), async (req, res) => {
    try {
      const input = cashbackLedgerOperationSchema.parse(req.body);
      res
        .status(201)
        .json(await storage.creditCashback(getTenantId(req), input, getAuditContext(req)));
    } catch (error) {
      sendCashbackLedgerError(res, error);
    }
  });

  v1Router.post("/cashback/debit", requireAuth, requireRole("manager"), async (req, res) => {
    try {
      const input = cashbackLedgerOperationSchema.parse(req.body);
      res
        .status(201)
        .json(await storage.debitCashback(getTenantId(req), input, getAuditContext(req)));
    } catch (error) {
      sendCashbackLedgerError(res, error);
    }
  });

  v1Router.post(
    "/cashback/transactions/:id/reverse",
    requireAuth,
    requireRole("manager"),
    async (req, res) => {
      try {
        const transactionId = z.coerce.number().int().positive().parse(req.params.id);
        const { idempotencyKey } = z
          .object({ idempotencyKey: z.string().trim().min(8).max(200) })
          .strict()
          .parse(req.body);
        res
          .status(201)
          .json(
            await storage.reverseCashback(
              getTenantId(req),
              transactionId,
              idempotencyKey,
              getAuditContext(req),
            ),
          );
      } catch (error) {
        sendCashbackLedgerError(res, error);
      }
    },
  );

  v1Router.post("/cashback/expire", requireAuth, requireRole("manager"), async (req, res) => {
    try {
      const { now } = z
        .object({ now: z.string().datetime().optional() })
        .strict()
        .parse(req.body ?? {});
      res.json({
        transactions: await storage.expireCashback(getTenantId(req), now, getAuditContext(req)),
      });
    } catch (error) {
      sendCashbackLedgerError(res, error);
    }
  });

  v1Router.get("/cashback/reconcile", requireAuth, requireRole("manager"), async (req, res) => {
    try {
      const parsed = z
        .object({ customerId: z.coerce.number().int().positive().optional() })
        .strict()
        .parse(req.query);
      const results = await storage.reconcileCashback(
        getTenantId(req),
        parsed.customerId,
        getAuditContext(req),
      );
      res.json({ consistent: results.every((item) => item.consistent), results });
    } catch (error) {
      sendCashbackLedgerError(res, error);
    }
  });

  // ==================== CUSTOMER 360 ROUTES ====================
  v1Router.get("/customers/:id/360", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
      }
      const customer360 = await storage.getCustomer360(tenantId, customerId);

      if (!customer360) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      res.json(customer360);
    } catch (error) {
      logger.error("Customer 360 fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/customers/:id/360",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        customerId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar visão 360 do cliente" });
    }
  });

  v1Router.get("/customers/:id/history", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
      }
      const customer = await storage.getCustomer(tenantId, customerId);

      if (!customer) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      const history = await storage.getCustomerOrderHistory(tenantId, customerId);

      res.json({
        customer,
        ...history,
      });
    } catch (error) {
      logger.error("Customer history fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/customers/:id/history",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        customerId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar histórico do cliente" });
    }
  });

  v1Router.get("/customers/:id/cashback", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return sendError(res, 400, "ID de cliente inválido", "INVALID_ID");
      }
      const customer = await storage.getCustomer(tenantId, customerId);

      if (!customer) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      const transactions = await storage.getCashbackTransactions(tenantId, customerId);
      const balance = await storage.getCustomerCashbackBalance(tenantId, customerId);

      res.json({
        customer,
        balance,
        transactions,
      });
    } catch (error) {
      logger.error("Customer cashback fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/customers/:id/cashback",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        customerId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar cashback do cliente" });
    }
  });

  // ==================== CAMPAIGN STATS ROUTES ====================
  /**
   * @description Campaign counters plus delivery statistics derived from
   *              persisted recipients. Attribution metrics (open rate,
   *              conversion, revenue) stay null until real attribution events
   *              exist, per ADR 0002.
   * @route GET /api/v1/campaigns/stats
   * @access authenticated
   */
  v1Router.get("/campaigns/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      const campaigns = await storage.getCampaigns(tenantId);
      const delivery = getCampaignDeliveryStats(tenantId);

      res.json({
        total: campaigns.length,
        sent: campaigns.filter((c) => c.status === "sent").length,
        draft: campaigns.filter((c) => c.status === "draft").length,
        scheduled: campaigns.filter((c) => c.status === "scheduled").length,
        failed: campaigns.filter((c) => c.status === "failed").length,
        delivery,
        // Explicitly unavailable rather than a zero that reads as a real metric.
        attribution: {
          available: false,
          reason: "Attribution events are not collected yet",
          openRate: null,
          conversion: null,
          revenue: null,
        },
      });
    } catch (error) {
      logger.error("Campaign stats fetch failed", {
        requestId: (req as Request & { requestId?: string }).requestId,
        endpoint: "/api/v1/campaigns/stats",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar estatísticas de campanhas" });
    }
  });

  /**
   * @description Campaign templates restricted to audiences and channels the
   *              dispatcher can actually resolve, so a template never promises
   *              a segment the server cannot build.
   * @route GET /api/v1/campaigns/templates
   * @access authenticated
   */
  v1Router.get("/campaigns/templates", requireAuth, (_req: Request, res: Response) => {
    const catalog = [
      {
        id: 1,
        name: "Boas-vindas",
        channel: "email",
        audience: "Novos clientes",
        message: "Bem-vindo à nossa loja! Aproveite 10% de desconto na sua primeira compra.",
      },
      {
        id: 2,
        name: "Aniversário",
        channel: "whatsapp",
        audience: "Aniversariantes do mês",
        message: "Feliz aniversário! Ganhe um presente especial na sua próxima compra.",
      },
      {
        id: 3,
        name: "Reativação",
        channel: "sms",
        audience: "Clientes inativos",
        message: "Sentimos sua falta! Volte e ganhe 15% de desconto.",
      },
      {
        id: 4,
        name: "Relacionamento VIP",
        channel: "email",
        audience: "Clientes VIP",
        message: "Condição exclusiva para nossos clientes VIP.",
      },
    ];

    const audiences = new Set(supportedAudiences());
    const available = new Set<string>(configuredChannels());

    res.json(
      catalog
        .filter((template) => audiences.has(template.audience))
        .map((template) => ({
          ...template,
          // The UI must be able to distinguish "supported" from "ready to send".
          channelConfigured: available.has(template.channel),
        })),
    );
  });

  // ==================== AUTOMATION ROUTES ====================
  v1Router.get("/automations/suggested", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }

      // Return suggested automations based on business rules
      const suggestions = [
        {
          id: "welcome-series",
          title: "Série de Boas-vindas",
          description: "Envie 3 emails automáticos para novos clientes",
          icon: "mail",
          estimatedImpact: "+15% conversão",
        },
        {
          id: "abandoned-cart",
          title: "Carrinho Abandonado",
          description: "Recupere vendas perdidas automaticamente",
          icon: "shopping-cart",
          estimatedImpact: "+8% receita",
        },
        {
          id: "birthday",
          title: "Aniversário",
          description: "Parabenize clientes no dia do aniversário",
          icon: "gift",
          estimatedImpact: "+12% engajamento",
        },
        {
          id: "cashback-expiring",
          title: "Cashback Expirando",
          description: "Notifique sobre cashback prestes a expirar",
          icon: "dollar-sign",
          estimatedImpact: "+20% uso de cashback",
        },
        {
          id: "win-back",
          title: "Reconquista",
          description: "Reative clientes inativos há 90 dias",
          icon: "user-plus",
          estimatedImpact: "+5% reativação",
        },
      ];

      res.json(suggestions);
    } catch (error) {
      logger.error("Automation suggestions fetch failed", {
        requestId: (req as any).requestId,
        endpoint: "/api/v1/automations/suggested",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar sugestões de automações" });
    }
  });

  /**
   * @description Real automation execution history for the active tenant
   * @route GET /api/v1/automations/history
   * @access authenticated
   */
  v1Router.get("/automations/history", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return sendError(res, 400, "Tenant não selecionado", "TENANT_NOT_SELECTED");
      }
      const query = automationHistoryQuerySchema.parse(req.query);
      const result = getAutomationHistory(tenantId, {
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
        automationId: query.automationId,
      });
      res.json({
        data: result.data,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / query.limit),
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const parsed = handleZodError(error);
        return sendError(res, 400, parsed.message, "VALIDATION_ERROR", parsed.details);
      }
      logger.error("Automation history fetch failed", {
        requestId: (req as Request & { requestId?: string }).requestId,
        endpoint: "/api/v1/automations/history",
        userId: req.session.user?.id,
        tenantId: getTenantId(req),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Erro ao buscar histórico de automações" });
    }
  });

  /**
   * @description Declares which delivery channels, triggers and audiences the
   *              server can actually execute, so the UI never offers a
   *              capability that would fail closed.
   * @route GET /api/v1/automations/capabilities
   * @access authenticated
   */
  v1Router.get("/automations/capabilities", requireAuth, (_req: Request, res: Response) => {
    res.json({
      triggers: SUPPORTED_AUTOMATION_TRIGGERS,
      actions: SUPPORTED_AUTOMATION_ACTIONS,
      channels: SUPPORTED_DELIVERY_CHANNELS,
      configuredChannels: configuredChannels(),
      audiences: supportedAudiences(),
    });
  });

  // Mount v1 API routes
  app.use("/api/v1", v1Router);

  // An unknown API path must answer with JSON. Without this the SPA fallback
  // would return index.html with status 200 and clients would parse HTML as a
  // successful API response.
  app.use("/api", (req: Request, res: Response) => {
    sendError(
      res,
      404,
      `Rota não encontrada: ${req.method} ${req.baseUrl}${req.path}`,
      "ROUTE_NOT_FOUND",
    );
  });

  return httpServer;
}
