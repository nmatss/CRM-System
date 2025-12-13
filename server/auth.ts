import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import session from "express-session";
import type { Express } from "express";
import { storage } from "./storage";
import { SessionUser, UserRole } from "@shared/schema";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

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

export function setupSession(app: Express) {
  const PgStore = connectPgSimple(session);
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const sessionSecret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && !sessionSecret) {
    throw new Error("SESSION_SECRET is required in production");
  }

  app.use(
    session({
      store: new PgStore({
        pool,
        tableName: "user_sessions",
        createTableIfMissing: true,
      }),
      secret: sessionSecret || "dev-only-secret-not-for-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
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

export async function createSuperAdminIfNotExists() {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  
  const adminEmail = process.env.ADMIN_EMAIL || "admin@moda.crm";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  
  const existingAdmin = await storage.getUserByEmail(adminEmail);
  if (!existingAdmin) {
    const hashedPassword = await hashPassword(adminPassword);
    await storage.createUser({
      email: adminEmail,
      password: hashedPassword,
      name: "Super Admin",
      isSuperAdmin: true,
    });
    console.log(`[DEV] Super Admin created: ${adminEmail}`);
  }
}
