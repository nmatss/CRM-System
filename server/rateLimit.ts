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
 * Reads a bounded numeric operational knob. An out-of-range or malformed value
 * falls back to the default instead of silently disabling a control.
 */
function boundedEnvNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    console.warn(`[RATE_LIMIT] Ignoring out-of-range ${name}; using ${fallback}`);
    return fallback;
  }
  return parsed;
}

/**
 * General rate limiter for all API endpoints.
 *
 * Defaults to 100 requests per minute per IP. Operators can raise it because a
 * single-page client behind corporate NAT legitimately exceeds that; the
 * authentication limiters below are deliberately not tunable.
 */
export const generalLimiter = rateLimit({
  windowMs: boundedEnvNumber("GENERAL_RATE_LIMIT_WINDOW_MS", 60_000, 1_000, 3_600_000),
  max: boundedEnvNumber("GENERAL_RATE_LIMIT_MAX", 100, 10, 1_000_000),
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
 * Rate limiter for the public lead-capture endpoints.
 *
 * These are unauthenticated and persist personal data, so the general limiter
 * is far too permissive: at 100 requests per minute a bot could store tens of
 * thousands of leads a day. A human fills these forms once.
 */
export const publicLeadLimiter = rateLimit({
  windowMs: boundedEnvNumber("PUBLIC_LEAD_RATE_LIMIT_WINDOW_MS", 3_600_000, 60_000, 86_400_000),
  max: boundedEnvNumber("PUBLIC_LEAD_RATE_LIMIT_MAX", 5, 1, 100_000),
  keyGenerator: ipKey,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Muitas solicitações. Por favor, tente novamente mais tarde.",
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
