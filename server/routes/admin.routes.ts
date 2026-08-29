import type { Router } from "express";
import {
  ZodError,
  getAuditContext,
  getTenantId,
  handleZodError,
  hashPassword,
  insertTenantSchema,
  logger,
  normalizeAssignableRole,
  normalizeEmail,
  passwordResetLimiter,
  requireAuth,
  requireRole,
  requireStrongTemporaryPassword,
  requireSuperAdmin,
  requireTenantContext,
  sendError,
  storage,
  z,
} from "./shared";
import type { AuditAction, Request, Response } from "./shared";

/**
 * Super admin: tenants, users, memberships and the global audit stream. Also installs the tenant-context middleware every tenant-scoped router below depends on.
 */
export function registerAdminRoutes(v1Router: Router): void {
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
      "/search",
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
}
