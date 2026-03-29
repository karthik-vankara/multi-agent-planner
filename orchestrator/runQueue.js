import { QUEUE_CONCURRENCY, QUEUE_MAX_SIZE } from "../config/env.js";
import { executeRun } from "./runExecutor.js";
import { updateRun, isCancelled } from "./runStore.js";
import { QueueFullError } from "../utils/errors.js";

let active  = 0;            // currently running jobs
const waiting = [];         // pending { runId, goalText, resolve, reject }

/**
 * Enqueue a run for async execution.
 * Returns a promise that resolves when the run completes (or rejects on error).
 * The caller does NOT need to await — the promise is purely for internal tracking.
 */
export function enqueue(runId, goalText) {
  if (waiting.length >= QUEUE_MAX_SIZE) {
    updateRun(runId, { status: "failed", error: "Queue full", completedAt: new Date() });
    throw new QueueFullError();
  }

  const promise = new Promise((resolve, reject) => {
    waiting.push({ runId, goalText, resolve, reject });
  });

  _drain();
  return promise;
}

function _drain() {
  while (active < QUEUE_CONCURRENCY && waiting.length > 0) {
    const job = waiting.shift();
    active++;
    _execute(job).finally(() => {
      active--;
      _drain();
    });
  }
}

async function _execute({ runId, goalText, resolve, reject }) {
  // Skip immediately if cancelled while queued
  if (isCancelled(runId)) {
    resolve(null);
    return;
  }

  updateRun(runId, { status: "running", startedAt: new Date() });

  try {
    const result = await executeRun(goalText, {
      isCancelled: () => isCancelled(runId),
      onProgress:  (patch) => updateRun(runId, patch),
    });

    if (isCancelled(runId)) {
      updateRun(runId, { status: "cancelled", completedAt: new Date() });
    } else {
      updateRun(runId, { status: "completed", result, completedAt: new Date() });
    }

    resolve(result);
  } catch (err) {
    updateRun(runId, {
      status:      "failed",
      error:       err.message ?? "Unknown error",
      completedAt: new Date(),
    });
    reject(err);
  }
}
