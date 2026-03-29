import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_S } from "../config/env.js";
import { RateLimitError } from "../utils/errors.js";

/**
 * In-memory sliding-window rate limiter.
 * Keyed by clientId (set by auth middleware) falling back to remote IP.
 *
 * Each entry in the store is an array of timestamps (epoch ms).
 * On every request we prune timestamps older than the window, then check count.
 */
const store = new Map(); // key -> number[] (timestamps)

function getKey(req) {
  return req.clientId ?? req.ip ?? "unknown";
}

export function rateLimiter(req, res, next) {
  const key  = getKey(req);
  const now  = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_S * 1000;

  const timestamps = (store.get(key) ?? []).filter(t => now - t < windowMs);
  timestamps.push(now);
  store.set(key, timestamps);

  const remaining = Math.max(0, RATE_LIMIT_MAX - timestamps.length);
  const resetAt   = Math.ceil((timestamps[0] + windowMs) / 1000); // unix seconds

  res.setHeader("X-RateLimit-Limit",     RATE_LIMIT_MAX);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset",     resetAt);

  if (timestamps.length > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((timestamps[0] + windowMs - now) / 1000);
    res.setHeader("Retry-After", retryAfter);
    return next(new RateLimitError(retryAfter));
  }

  next();
}

// Prevent unbounded memory growth: purge stale keys every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_S * 1000;
  for (const [key, timestamps] of store.entries()) {
    if (timestamps.every(t => t < cutoff)) store.delete(key);
  }
}, 5 * 60 * 1000).unref();
