import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import session from "express-session";
import type { Express } from "express";
import { normalizeEmail } from "@shared/schema";
import { storage } from "./storage";
import { SessionUser, UserRole } from "@shared/schema";
import SqliteStore from "better-sqlite3-session-store";
import { sessionSqlite } from "./sessionDb";

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}

const SALT_ROUNDS = 10;
const PLACEHOLDER_PATTERN = /(change-this|your-super-secret|dev-only|password|admin123)/i;
export const SESSION_COOKIE_NAME = "zippcrm.sid";

function assertProductionSecret(name: string, value: string | undefined, minLength: number) {
  if (!value || value.length < minLength || PLACEHOLDER_PATTERN.test(value)) {
    throw new Error(
      `${name} is required in production and must be a non-placeholder value with at least ${minLength} characters.`,
    );
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Configure session middleware with SQLite-based storage
 *
 * Sessions are persisted to the SQLite database, ensuring they survive server restarts.
 * The better-sqlite3-session-store package creates and manages the sessions table.
 *
 * Features:
 * - Persistent sessions across server restarts
 * - Automatic cleanup of expired sessions every 15 minutes
 * - 24-hour session lifetime
 * - Secure cookies in production (HTTPS only)
 */
export function setupSession(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    assertProductionSecret("SESSION_SECRET", sessionSecret, 32);
  }

  // Create SQLite session store for persistent session storage
  const SessionStore = SqliteStore(session);

  app.use(
    session({
      name: SESSION_COOKIE_NAME,
      store: new SessionStore({
        client: sessionSqlite,
        expired: {
          clear: true,
          intervalMs: 900000, // Clean up expired sessions every 15 minutes
        },
      }),
      secret: sessionSecret || "dev-only-secret-not-for-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: "lax", // Protection against CSRF attacks
      },
    }),
  );
}

function isPasswordChangeAllowedPath(req: Request): boolean {
  const path = req.originalUrl.split("?")[0];
  return [
    "/api/v1/auth/change-password",
    "/api/v1/auth/logout",
    "/api/v1/auth/me",
    "/api/v1/csrf-token",
  ].includes(path);
}

async function getFreshSessionUser(req: Request, res: Response): Promise<SessionUser | undefined> {
  if (!req.session?.user) {
    return undefined;
  }

  const user = await storage.getUser(req.session.user.id);
  if (!user || user.status !== "active") {
    req.session.destroy(() => undefined);
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return undefined;
  }

  const sessionPasswordChange = req.session.user.lastPasswordChange ?? null;
  const currentPasswordChange = user.lastPasswordChange ?? null;
  if (sessionPasswordChange !== currentPasswordChange) {
    req.session.destroy(() => undefined);
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return undefined;
  }

  req.session.user = {
    ...req.session.user,
    email: user.email,
    cpf: user.cpf,
    name: user.name,
    isSuperAdmin: user.isSuperAdmin,
    mustChangePassword: user.mustChangePassword,
    lastPasswordChange: user.lastPasswordChange,
  };

  return req.session.user;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getFreshSessionUser(req, res);
    if (!user) {
      return res.status(401).json({ error: "Autenticação necessária" });
    }

    if (user.mustChangePassword && !isPasswordChangeAllowedPath(req)) {
      return res.status(403).json({
        error: "Troca de senha obrigatória",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
    }

    next();
  } catch {
    return res.status(401).json({ error: "Autenticação necessária" });
  }
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getFreshSessionUser(req, res);
    if (!user) {
      return res.status(401).json({ error: "Autenticação necessária" });
    }
    if (user.mustChangePassword && !isPasswordChangeAllowedPath(req)) {
      return res.status(403).json({
        error: "Troca de senha obrigatória",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
    }
    if (!user.isSuperAdmin) {
      return res.status(403).json({ error: "Acesso restrito a super administradores" });
    }
    next();
  } catch {
    return res.status(401).json({ error: "Autenticação necessária" });
  }
}

export async function requireTenantAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getFreshSessionUser(req, res);
    if (!user) {
      return res.status(401).json({ error: "Autenticação necessária" });
    }

    if (user.mustChangePassword && !isPasswordChangeAllowedPath(req)) {
      return res.status(403).json({
        error: "Troca de senha obrigatória",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
    }

    const tenantId = parseInt(req.params.tenantId || (req.query.tenantId as string));

    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID é obrigatório" });
    }

    const tenant = await storage.getTenant(tenantId);
    if (!tenant || tenant.status !== "active") {
      return res.status(403).json({ error: "Acesso negado a este tenant" });
    }

    if (user.isSuperAdmin) {
      return next();
    }

    if (user.tenantId !== tenantId) {
      return res.status(403).json({ error: "Acesso negado a este tenant" });
    }

    const tenantUser = await storage.getTenantUser(tenantId, user.id);
    if (!tenantUser?.isActive) {
      return res.status(403).json({ error: "Acesso negado a este tenant" });
    }

    req.session.user = {
      ...user,
      role: tenantUser.role as UserRole,
    };

    next();
  } catch {
    return res.status(401).json({ error: "Autenticação necessária" });
  }
}

/**
 * Revalidates the tenant context stored in the authenticated session.
 * Tenant-scoped routes must use this middleware even for read-only requests so
 * membership and tenant revocations take effect immediately.
 */
export async function requireTenantContext(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getFreshSessionUser(req, res);
    if (!user) {
      return res.status(401).json({ error: "Autenticação necessária" });
    }

    if (user.mustChangePassword && !isPasswordChangeAllowedPath(req)) {
      return res.status(403).json({
        error: "Troca de senha obrigatória",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return res.status(403).json({
        error: "Tenant não selecionado",
        code: "TENANT_NOT_SELECTED",
      });
    }

    const tenant = await storage.getTenant(tenantId);
    if (!tenant || tenant.status !== "active") {
      return res.status(403).json({
        error: "Acesso negado a este tenant",
        code: "TENANT_ACCESS_REVOKED",
      });
    }

    if (user.isSuperAdmin) {
      return next();
    }

    const tenantUser = await storage.getTenantUser(tenantId, user.id);
    if (!tenantUser?.isActive) {
      return res.status(403).json({
        error: "Acesso negado a este tenant",
        code: "TENANT_ACCESS_REVOKED",
      });
    }

    req.session.user = {
      ...user,
      role: tenantUser.role as UserRole,
    };

    next();
  } catch {
    return res.status(401).json({ error: "Autenticação necessária" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getFreshSessionUser(req, res);
      if (!user) {
        return res.status(401).json({ error: "Autenticação necessária" });
      }

      if (user.mustChangePassword && !isPasswordChangeAllowedPath(req)) {
        return res.status(403).json({
          error: "Troca de senha obrigatória",
          code: "PASSWORD_CHANGE_REQUIRED",
        });
      }

      if (user.isSuperAdmin) {
        return next();
      }

      if (!user.tenantId) {
        return res.status(403).json({ error: "Tenant não selecionado" });
      }

      const [tenant, tenantUser] = await Promise.all([
        storage.getTenant(user.tenantId),
        storage.getTenantUser(user.tenantId, user.id),
      ]);

      if (!tenant || tenant.status !== "active" || !tenantUser?.isActive) {
        return res.status(403).json({ error: "Acesso negado a este tenant" });
      }

      req.session.user = {
        ...user,
        role: tenantUser.role as UserRole,
      };

      if (!roles.includes(tenantUser.role as UserRole)) {
        return res.status(403).json({ error: "Permissão insuficiente" });
      }

      next();
    } catch {
      return res.status(401).json({ error: "Autenticação necessária" });
    }
  };
}

export async function createSuperAdminIfNotExists() {
  const adminEmail = process.env.ADMIN_EMAIL ? normalizeEmail(process.env.ADMIN_EMAIL) : undefined;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Validate required environment variables in production
  if (process.env.NODE_ENV === "production") {
    assertProductionSecret("ADMIN_PASSWORD", adminPassword, 12);

    if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      throw new Error("ADMIN_EMAIL is required in production and must be a valid email address.");
    }
  }

  // Never synthesize or print an administrative credential. Creating an account
  // with an unknown password also prevents a later explicit bootstrap from
  // recovering access to the same email.
  if (process.env.NODE_ENV !== "production" && !adminPassword) {
    console.warn(
      "[SECURITY] Super admin bootstrap skipped: set ADMIN_PASSWORD explicitly to create the initial account.",
    );
    return;
  }

  // Use defaults only in development and only if not provided
  const finalEmail = normalizeEmail(adminEmail || "admin@zippi.crm");
  const finalPassword = adminPassword!; // We know it's defined at this point

  const existingAdmin = await storage.getUserByEmail(finalEmail);
  if (!existingAdmin) {
    const hashedPassword = await hashPassword(finalPassword);
    await storage.createUser({
      email: finalEmail,
      password: hashedPassword,
      name: "Super Admin",
      isSuperAdmin: true,
    });
    console.log(`[SYSTEM] Super Admin created: ${finalEmail}`);
  }
}
