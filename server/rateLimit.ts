import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

function ipKey(req: Request): string {
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || "127.0.0.1");
}

function normalizeRateLimitValue(value: unknown): string {
  if (typeof value !== "string") {
    return "unknown";
  }
  return value.trim().toLowerCase().replace(/\s+/g, "").slice(0, 128) || "unknown";
}

function loginIdentityKey(req: Request): string {
  return `${ipKey(req)}:${normalizeRateLimitValue(req.body?.username)}`;
}

function passwordResetIdentityKey(req: Request): string {
  const requester = req.session?.user?.id || "anonymous";
  const target = req.params?.userId || req.body?.userId || requester;
  return `${ipKey(req)}:${normalizeRateLimitValue(requester)}:${normalizeRateLimitValue(target)}`;
}

/**
 * General rate limiter for all API endpoints
 * Limits: 100 requests per minute per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  keyGenerator: ipKey,
  standardHeaders: "draft-8", // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: "Muitas requisições. Por favor, tente novamente em alguns instantes.",
  },
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    return req.path === "/api/health";
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * Limits login attempts per IP.
 * This helps prevent brute force attacks
 */
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  keyGenerator: ipKey,
  standardHeaders: "draft-8", // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: true, // Don't count successful requests
  message: {
    error: "Muitas tentativas de login. Por favor, tente novamente em 15 minutos.",
  },
});

/**
 * Strict rate limiter for login attempts against the same normalized account
 * from the same IP. This complements authIpLimiter without logging credentials.
 */
export const authAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: loginIdentityKey,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "Muitas tentativas de login. Por favor, tente novamente em 15 minutos.",
  },
});

/**
 * Rate limiter for registration endpoint
 * Limits: 3 registration attempts per hour per IP
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  keyGenerator: ipKey,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Muitas tentativas de registro. Por favor, tente novamente em 1 hora.",
  },
});

/**
 * Rate limiter for password reset endpoints
 * Limits: 3 password reset attempts per hour per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  keyGenerator: passwordResetIdentityKey,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Muitas tentativas de alteração de senha. Por favor, tente novamente em 1 hora.",
  },
});
