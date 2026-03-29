import { API_KEY } from "../config/env.js";
import { AuthError } from "../utils/errors.js";

function isPublicPath(path = "") {
  // Vercel and some rewrites can expose health as /api/health.
  // Keep both forms (with optional trailing slash) public.
  return path === "/health" || path === "/health/" || path === "/api/health" || path === "/api/health/";
}

/**
 * Static API-key auth middleware.
 * Clients must send:  Authorization: Bearer <API_KEY>
 *
 * If API_KEY is not configured in env this middleware is a no-op (dev mode).
 */
export function auth(req, res, next) {
  // Keep liveness checks public so monitors and deployment probes can work.
  if (isPublicPath(req.path)) return next();

  if (!API_KEY) return next(); // auth disabled

  const header = req.headers["authorization"] ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token || token !== API_KEY) {
    return next(new AuthError());
  }

  // Attach a lightweight identity object for use by rate-limiter and logs
  req.clientId = `key:${token.slice(0, 8)}`;
  next();
}
