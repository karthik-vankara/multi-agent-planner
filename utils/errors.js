/**
 * Shared application error primitives.
 * All errors carry a machine-readable `code` and an HTTP `status`.
 */

// ── Base API error ────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(message, status = 500, code = "INTERNAL_ERROR", details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ── Validation ────────────────────────────────────────────────────────────────
export class ValidationError extends ApiError {
  constructor(message, details = null) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export class AuthError extends ApiError {
  constructor(message = "Invalid or missing API key") {
    super(message, 401, "AUTH_ERROR");
    this.name = "AuthError";
  }
}

// ── Rate limit ────────────────────────────────────────────────────────────────
export class RateLimitError extends ApiError {
  constructor(retryAfterSeconds = 60) {
    super("Too many requests", 429, "RATE_LIMIT_EXCEEDED");
    this.name = "RateLimitError";
    this.retryAfter = retryAfterSeconds;
  }
}

// ── LLM ───────────────────────────────────────────────────────────────────────
export class LLMError extends ApiError {
  constructor(message, cause = null, attemptCount = 0) {
    super(message, 502, "LLM_ERROR");
    this.name = "LLMError";
    this.cause = cause;
    this.attemptCount = attemptCount;
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(attemptCount = 0) {
    super(`LLM call timed out after ${attemptCount} attempt(s)`, null, attemptCount);
    this.name = "LLMTimeoutError";
    this.code = "LLM_TIMEOUT";
  }
}

export class LLMParseError extends LLMError {
  constructor(rawContent = "") {
    super("LLM returned non-JSON output after retry", null, 2);
    this.name = "LLMParseError";
    this.code = "LLM_PARSE_ERROR";
    this.rawContent = rawContent;
  }
}

// ── Run lifecycle ─────────────────────────────────────────────────────────────
export class RunNotFoundError extends ApiError {
  constructor(runId) {
    super(`Run '${runId}' not found`, 404, "RUN_NOT_FOUND");
    this.name = "RunNotFoundError";
  }
}

export class RunCancelledError extends ApiError {
  constructor(runId) {
    super(`Run '${runId}' was cancelled`, 409, "RUN_CANCELLED");
    this.name = "RunCancelledError";
  }
}

export class QueueFullError extends ApiError {
  constructor() {
    super("Server is busy. Try again shortly.", 503, "QUEUE_FULL");
    this.name = "QueueFullError";
  }
}
