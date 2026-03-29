/**
 * Centralised environment configuration.
 * Load this module once at startup; all other modules import from here.
 * Throws at startup if required variables are missing.
 */
import dotenv from "dotenv";
dotenv.config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function optional(name, fallback) {
  return process.env[name] ?? fallback;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const API_KEY = optional("API_KEY", null);           // null = auth disabled (dev)

// ── CORS ─────────────────────────────────────────────────────────────────────
// Comma-separated list, e.g. "http://localhost:5173,https://myapp.com"
// "*" disables the allowlist check (dev only)
export const ALLOWED_ORIGINS = optional("ALLOWED_ORIGINS", "*");

// ── Request limits ────────────────────────────────────────────────────────────
export const MAX_BODY_KB   = parseInt(optional("MAX_BODY_KB",  "10"),  10);

// ── Rate limiting ─────────────────────────────────────────────────────────────
export const RATE_LIMIT_MAX      = parseInt(optional("RATE_LIMIT_MAX",      "20"),  10); // max requests
export const RATE_LIMIT_WINDOW_S = parseInt(optional("RATE_LIMIT_WINDOW_S", "60"),  10); // per N seconds

// ── LLM resilience ────────────────────────────────────────────────────────────
export const LLM_TIMEOUT_MS  = parseInt(optional("LLM_TIMEOUT_MS",  "45000"), 10);
export const LLM_MAX_RETRIES = parseInt(optional("LLM_MAX_RETRIES", "3"),     10);

// ── Orchestration ─────────────────────────────────────────────────────────────
export const MAX_ITERATIONS   = parseInt(optional("MAX_ITERATIONS",   "7"),  10);
export const QUEUE_CONCURRENCY = parseInt(optional("QUEUE_CONCURRENCY", "3"), 10);
export const QUEUE_MAX_SIZE    = parseInt(optional("QUEUE_MAX_SIZE",  "50"),  10);
export const RUN_TTL_MS        = parseInt(optional("RUN_TTL_MS", String(2 * 60 * 60 * 1000)), 10); // 2h

// ── OpenAI ───────────────────────────────────────────────────────────────────
export const OPENAI_API_KEY = required("OPENAI_API_KEY");
