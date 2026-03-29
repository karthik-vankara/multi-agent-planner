// ── Config must be imported first so env vars are loaded before any other module ──
import "../config/env.js";

import express from "express";

// Middleware
import { cors }          from "./middleware/cors.js";
import { auth }          from "./middleware/auth.js";
import { rateLimiter }   from "./middleware/rateLimiter.js";
import { errorHandler }  from "./middleware/errorHandler.js";

// Controllers
import { createRunHandler, getRunHandler, cancelRunHandler } from "./controllers/runsController.js";

// Shared utils
import { validateApiRequest } from "./utils/schemaValidator.js";
import { executeRun }         from "./orchestrator/runExecutor.js";

const MAX_BODY = (parseInt(process.env.MAX_BODY_KB ?? "10", 10)) * 1024;
const PORT     = parseInt(process.env.PORT ?? "3000", 10);

const app = express();

// ── Middleware stack (order matters) ─────────────────────────────────────────
app.use(express.json({ limit: MAX_BODY }));
app.use(cors);
app.use(auth);
app.use(rateLimiter);

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── Async run lifecycle ──────────────────────────────────────────────────────
/**
 * POST /runs
 * Start a new async planning run.
 * Returns 202 immediately with run_id for polling.
 */
app.post("/runs", createRunHandler);

/**
 * GET /runs/:run_id
 * Poll the status and result of a run.
 */
app.get("/runs/:run_id", getRunHandler);

/**
 * POST /runs/:run_id/cancel
 * Request cancellation of a queued or running run.
 */
app.post("/runs/:run_id/cancel", cancelRunHandler);

// ── Compatibility endpoint (deprecated — use POST /runs) ─────────────────────
/**
 * POST /plan
 * @deprecated  Use POST /runs for a non-blocking async experience.
 *              This endpoint blocks until the full run completes and will be
 *              removed in a future version.
 */
app.post("/plan", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    validateApiRequest(body);

    let goalText = body.goal.trim();
    if (body.days)  goalText += ` in ${body.days} days`;
    if (body.hours) goalText += ` with ${body.hours} hours daily`;

    console.log(`\n[API] POST /plan (deprecated) — goal: "${goalText}"`);

    const result = await executeRun(goalText);
    res.setHeader("Deprecation", "true");
    res.setHeader("Link",        '</runs>; rel="successor-version"');
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

// ── Central error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 Multi-Agent Planner API  →  http://localhost:${PORT}`);
  console.log(`   POST /runs                 { goal, days?, hours? }  → 202 + run_id`);
  console.log(`   GET  /runs/:id             poll status & result`);
  console.log(`   POST /runs/:id/cancel      cancel a run`);
  console.log(`   GET  /health`);
  console.log(`   POST /plan  [deprecated]   sync endpoint (kept for compat)\n`);
});
