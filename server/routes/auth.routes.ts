import type { Router } from "express";
import {
  SESSION_COOKIE_NAME,
  ZodError,
  auditLogin,
  auditLoginOrFailClosed,
  authAccountLimiter,
  authIpLimiter,
  comparePassword,
  destroySession,
  getAuditContext,
  handleZodError,
  hashPassword,
  logger,
  loginSchema,
  normalizeEmail,
  passwordResetLimiter,
  regenerateSession,
  registerLimiter,
  registerSchema,
  requireAuth,
  saveSession,
  sendError,
  storage,
} from "./shared";
import type { Request, Response } from "./shared";

/**
 * Login, logout, session, registration and password change.
 */
export function registerAuthRoutes(v1Router: Router): void {
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
}
