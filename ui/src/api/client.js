const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const API_KEY = import.meta.env.VITE_API_KEY?.trim();

function buildHeaders({ extraHeaders = {}, hasBody = false, includeAuth = true } = {}) {
  const headers = { ...extraHeaders };

  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (includeAuth && API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }

  return headers;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const retryAfter = response.headers.get("retry-after");
  const rateLimit = {
    limit: response.headers.get("x-ratelimit-limit"),
    remaining: response.headers.get("x-ratelimit-remaining"),
    reset: response.headers.get("x-ratelimit-reset"),
  };

  let payload = null;
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();
    payload = text ? { message: text } : null;
  }

  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.message || `Request failed with ${response.status}`);
    error.status = response.status;
    error.code = payload?.error?.code || "HTTP_ERROR";
    error.details = payload?.error?.details || null;
    error.retryAfter = retryAfter ? Number(retryAfter) : null;
    error.rateLimit = rateLimit;
    error.payload = payload;
    throw error;
  }

  return {
    payload,
    rateLimit,
    deprecation: response.headers.get("deprecation"),
  };
}

async function request(path, options = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const hasBody = options.body != null && method !== "GET" && method !== "HEAD";
  const includeAuth = path !== "/health";

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders({
      extraHeaders: options.headers,
      hasBody,
      includeAuth,
    }),
  });
  return parseResponse(response);
}

export async function getHealth() {
  const { payload } = await request("/health", { method: "GET" });
  return payload;
}

export async function createRun(input) {
  const { payload } = await request("/runs", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload;
}

export async function getRun(runId) {
  const { payload, rateLimit } = await request(`/runs/${runId}`, { method: "GET" });
  return { ...payload, _rateLimit: rateLimit };
}

export async function cancelRun(runId) {
  const { payload } = await request(`/runs/${runId}/cancel`, { method: "POST" });
  return payload;
}

export const clientConfig = {
  apiBaseUrl: API_BASE_URL,
  hasApiKey: Boolean(API_KEY),
  pollIntervalMs: Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 2000),
};
