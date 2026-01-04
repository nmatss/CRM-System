import rateLimit from "express-rate-limit";

/**
 * General rate limiter for all API endpoints
 * Limits: 100 requests per minute per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
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
 * Limits: 5 login attempts per 15 minutes per IP
 * This helps prevent brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per 15 minutes
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: true, // Don't count successful requests
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
  standardHeaders: true,
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
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Muitas tentativas de alteração de senha. Por favor, tente novamente em 1 hora.",
  },
});
