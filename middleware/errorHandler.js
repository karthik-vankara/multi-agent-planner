import { ApiError, ValidationError, AuthError, RateLimitError } from "../utils/errors.js";

/**
 * Central error handler — must be the last middleware registered in api.js.
 *
 * Converts all known ApiError subclasses to structured JSON responses.
 * Unknown errors become 500 Internal Server Error without leaking internals.
 */
export function errorHandler(err, req, res, _next) {
  if (err instanceof RateLimitError) {
    return res.status(err.status).json({
      success: false,
      error:   { code: err.code, message: err.message, retryAfter: err.retryAfter },
    });
  }

  if (err instanceof ApiError) {
    const body = { success: false, error: { code: err.code, message: err.message } };
    if (err.details) body.error.details = err.details;
    return res.status(err.status).json(body);
  }

  // Catch Express body-parser payload-too-large error
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds maximum allowed size." },
    });
  }

  // Unexpected error — log server-side, return sanitised 500
  console.error("[error]", err);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  });
}
