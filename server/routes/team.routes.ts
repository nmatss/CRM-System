import type { Router } from "express";
import {
  getAuditContext,
  getTenantId,
  hashPassword,
  logger,
  normalizeAssignableRole,
  normalizeEmail,
  passwordResetLimiter,
  requireAuth,
  requireRole,
  requireStrongTemporaryPassword,
  sendError,
  storage,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Tenant membership management performed by a manager.
 */
export function registerTeamRoutes(v1Router: Router): void {
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
}
