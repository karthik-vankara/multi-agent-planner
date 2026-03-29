import { API_KEY } from "../config/env.js";
import { AuthError } from "../utils/errors.js";

const PUBLIC_PATHS = new Set(["/health"]);

/**
 * Static API-key auth middleware.
 * Clients must send:  Authorization: Bearer <API_KEY>
 *
 * If API_KEY is not configured in env this middleware is a no-op (dev mode).
 */
export function auth(req, res, next) {
  // Keep liveness checks public so monitors and deployment probes can work.
  if (PUBLIC_PATHS.has(req.path)) return next();

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
