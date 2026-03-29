import { v4 as uuidv4 } from "uuid";
import { RUN_TTL_MS } from "../config/env.js";

/**
 * In-process run store.
 *
 * Each run record:
 *   id              string    UUID
 *   status          string    "queued" | "running" | "completed" | "failed" | "cancelled"
 *   input           object    { goal, days?, hours? }
 *   progress        object    { iteration, maxIterations }
 *   result          object|null
 *   error           string|null
 *   createdAt       Date
 *   startedAt       Date|null
 *   completedAt     Date|null
 *   _cancel         boolean   internal cancellation flag
 *
 * NOTE: data is in-process only and lost on restart — acceptable for P0.
 */
const runs = new Map();

export function createRun(input) {
  const run = {
    id:          uuidv4(),
    status:      "queued",
    input,
    progress:    { iteration: 0, maxIterations: 0 },
    result:      null,
    error:       null,
    createdAt:   new Date(),
    startedAt:   null,
    completedAt: null,
    _cancel:     false,
  };
  runs.set(run.id, run);
  return run;
}

export function getRun(id) {
  return runs.get(id) ?? null;
}

export function updateRun(id, patch) {
  const run = runs.get(id);
  if (!run) return null;
  Object.assign(run, patch);
  return run;
}

export function cancelRun(id) {
  const run = runs.get(id);
  if (!run) return null;
  run._cancel = true;
  // If still queued flip status immediately so polling sees it fast
  if (run.status === "queued") {
    run.status      = "cancelled";
    run.completedAt = new Date();
  }
  return run;
}

export function isCancelled(id) {
  return runs.get(id)?._cancel ?? false;
}

// ── TTL cleanup ──────────────────────────────────────────────────────────────
// Remove completed/failed/cancelled runs older than RUN_TTL_MS every 10 min.
const TERMINAL = new Set(["completed", "failed", "cancelled"]);
setInterval(() => {
  const cutoff = Date.now() - RUN_TTL_MS;
  for (const [id, run] of runs.entries()) {
    if (TERMINAL.has(run.status) && run.completedAt && run.completedAt.getTime() < cutoff) {
      runs.delete(id);
    }
  }
}, 10 * 60 * 1000).unref();
