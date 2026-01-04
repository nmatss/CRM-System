import { Request, Response, NextFunction } from "express";
import * as crypto from "crypto";
import type { Express } from "express";

// Note: SessionData.user is already declared in auth.ts
// We only need to add csrfSecret and csrfToken
declare module "express-session" {
  interface SessionData {
    csrfSecret?: string;
    csrfToken?: string;
  }
}

/**
 * Generate a CSRF token using HMAC with the session secret
 * The token is cryptographically tied to the session
 */
function generateToken(secret: string): string {
  const timestamp = Date.now().toString();
  const randomBytes = crypto.randomBytes(16).toString("hex");
  const data = `${timestamp}:${randomBytes}`;

  // Create HMAC signature
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(data);
  const signature = hmac.digest("hex");

  // Token format: timestamp:randomBytes:signature
  return Buffer.from(`${data}:${signature}`).toString("base64url");
}

/**
 * Verify a CSRF token using HMAC validation
 * This cryptographically verifies the token was generated with the session secret
 */
function verifyToken(secret: string, token: string): boolean {
  if (!secret || !token) {
    return false;
  }

  try {
    // Decode and parse the token
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");

    if (parts.length !== 3) {
      return false;
    }

    const [timestamp, randomBytes, providedSignature] = parts;

    // Verify timestamp is not too old (1 hour max)
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    const maxAge = 60 * 60 * 1000; // 1 hour
    if (isNaN(tokenAge) || tokenAge < 0 || tokenAge > maxAge) {
      return false;
    }

    // Recreate the expected signature
    const data = `${timestamp}:${randomBytes}`;
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(data);
    const expectedSignature = hmac.digest("hex");

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch (error) {
    return false;
  }
}

/**
 * Middleware to add CSRF token generation endpoint
 */
export function csrfTokenEndpoint(req: Request, res: Response) {
  // Ensure we have a secret in the session
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = crypto.randomBytes(32).toString("hex");
  }

  const token = generateToken(req.session.csrfSecret);
  res.json({ csrfToken: token });
}

/**
 * Middleware to protect routes from CSRF attacks
 * Only validates state-changing methods (POST, PUT, DELETE, PATCH)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip CSRF for public endpoints (no session)
  if (!req.session || !req.session.user) {
    return next();
  }

  // Get token from header
  const token = req.headers["x-csrf-token"] as string;

  if (!token) {
    return res.status(403).json({
      error: "CSRF token missing",
      message: "CSRF token é obrigatório para esta operação"
    });
  }

  // Verify token
  const secret = req.session.csrfSecret;
  if (!secret) {
    return res.status(403).json({
      error: "CSRF secret missing",
      message: "Sessão inválida. Por favor, faça login novamente."
    });
  }

  if (!verifyToken(secret, token)) {
    return res.status(403).json({
      error: "Invalid CSRF token",
      message: "Token CSRF inválido. Por favor, recarregue a página."
    });
  }

  next();
}

/**
 * Setup CSRF protection for the application
 */
export function setupCsrf(app: Express) {
  // Endpoint to get a fresh CSRF token
  app.get("/api/v1/csrf-token", (req, res) => csrfTokenEndpoint(req, res));

  // Apply CSRF protection to all /api routes except token endpoint
  app.use("/api", (req, res, next) => {
    // Skip CSRF token endpoint itself
    if (req.path === "/v1/csrf-token") {
      return next();
    }

    // Skip public endpoints that don't require authentication
    const publicEndpoints = [
      "/health",
      "/auth/login",
      "/auth/register",
      "/tenants/by-slug",
      "/contact",
      "/demo"
    ];

    const isPublicEndpoint = publicEndpoints.some(endpoint =>
      req.path === endpoint || req.path.startsWith(endpoint)
    );

    if (isPublicEndpoint && !req.session.user) {
      return next();
    }

    csrfProtection(req, res, next);
  });
}
