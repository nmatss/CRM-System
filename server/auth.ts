import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import session from "express-session";
import type { Express } from "express";
import crypto from "crypto";
import { storage } from "./storage";
import { SessionUser, UserRole } from "@shared/schema";
import SqliteStore from "better-sqlite3-session-store";
import { sqlite } from "./db";

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}

const SALT_ROUNDS = 10;

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
  if (process.env.NODE_ENV === "production" && !sessionSecret) {
    throw new Error("SESSION_SECRET is required in production");
  }

  // Create SQLite session store for persistent session storage
  const SessionStore = SqliteStore(session);

  app.use(
    session({
      store: new SessionStore({
        client: sqlite,
        expired: {
          clear: true,
          intervalMs: 900000 // Clean up expired sessions every 15 minutes
        }
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
    })
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Autenticação necessária" });
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Autenticação necessária" });
  }
  if (!req.session.user.isSuperAdmin) {
    return res.status(403).json({ error: "Acesso restrito a super administradores" });
  }
  next();
}

export function requireTenantAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Autenticação necessária" });
  }
  
  const tenantId = parseInt(req.params.tenantId || req.query.tenantId as string);
  
  if (!tenantId) {
    return res.status(400).json({ error: "Tenant ID é obrigatório" });
  }
  
  if (req.session.user.isSuperAdmin) {
    return next();
  }
  
  if (req.session.user.tenantId !== tenantId) {
    return res.status(403).json({ error: "Acesso negado a este tenant" });
  }
  
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Autenticação necessária" });
    }
    
    if (req.session.user.isSuperAdmin) {
      return next();
    }
    
    if (!req.session.user.role || !roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: "Permissão insuficiente" });
    }
    
    next();
  };
}

function generateSecurePassword(): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const length = 16;
  let password = "";
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }

  return password;
}

export async function createSuperAdminIfNotExists() {
  const adminEmail = process.env.ADMIN_EMAIL;
  let adminPassword = process.env.ADMIN_PASSWORD;

  // Validate required environment variables in production
  if (process.env.NODE_ENV === "production") {
    if (!adminEmail || !adminPassword) {
      throw new Error(
        "ADMIN_EMAIL and ADMIN_PASSWORD are REQUIRED in production environment. " +
        "Please set these environment variables before starting the application."
      );
    }
  }

  // Handle development environment
  if (process.env.NODE_ENV !== "production") {
    if (!adminEmail || !adminPassword) {
      console.warn("\n" + "=".repeat(80));
      console.warn("WARNING: Running in development mode without proper admin credentials!");
      console.warn("ADMIN_EMAIL and/or ADMIN_PASSWORD environment variables are not set.");
      console.warn("This is INSECURE and should only be used for development/testing.");
      console.warn("=".repeat(80) + "\n");

      // Generate random password if not provided
      if (!adminPassword) {
        adminPassword = generateSecurePassword();
        console.log("\n" + "=".repeat(80));
        console.log("[SECURITY] Generated random admin password for development:");
        console.log(`[SECURITY] Email: ${adminEmail || "admin@zippi.crm"}`);
        console.log(`[SECURITY] Password: ${adminPassword}`);
        console.log("[SECURITY] SAVE THIS PASSWORD - It will not be shown again!");
        console.log("=".repeat(80) + "\n");
      }
    }
  }

  // Use defaults only in development and only if not provided
  const finalEmail = adminEmail || "admin@zippi.crm";
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
