import { ALLOWED_ORIGINS } from "../config/env.js";

const allowAll = ALLOWED_ORIGINS.trim() === "*";
const allowlist = allowAll
  ? null
  : new Set(ALLOWED_ORIGINS.split(",").map(o => o.trim()).filter(Boolean));

/**
 * CORS middleware.
 * - Allows all origins in development (ALLOWED_ORIGINS=*)
 * - Restricts to the configured allowlist in production
 * - Handles preflight OPTIONS requests
 */
export function cors(req, res, next) {
  const origin = req.headers["origin"];

  if (origin) {
    const allowed = allowAll || allowlist.has(origin);
    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin",      origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  }

  res.setHeader("Access-Control-Allow-Methods",  "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers",  "Content-Type,Authorization");
  res.setHeader("Access-Control-Max-Age",        "86400");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
}
