import { validateApiRequest } from "../utils/schemaValidator.js";
import { createRun, getRun, cancelRun } from "../orchestrator/runStore.js";
import { enqueue } from "../orchestrator/runQueue.js";
import { RunNotFoundError, ValidationError } from "../utils/errors.js";

/**
 * POST /runs
 * Validate request, create a run record, enqueue execution, return 202 immediately.
 */
export async function createRunHandler(req, res, next) {
  try {
    const body = req.body ?? {};
    validateApiRequest(body);

    let goalText = body.goal.trim();
    if (body.days)  goalText += ` in ${body.days} days`;
    if (body.hours) goalText += ` with ${body.hours} hours daily`;

    const run = createRun({ goal: body.goal, days: body.days, hours: body.hours });

    // Fire-and-forget — errors are stored in runStore by runQueue
    enqueue(run.id, goalText).catch(() => {});

    console.log(`[runs] created run ${run.id}`);

    return res.status(202).json({
      success:     true,
      run_id:      run.id,
      status:      run.status,
      created_at:  run.createdAt,
      polling_url: `/runs/${run.id}`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /runs/:run_id
 * Return current status + result of a run.
 */
export async function getRunHandler(req, res, next) {
  try {
    const run = getRun(req.params.run_id);
    if (!run) return next(new RunNotFoundError(req.params.run_id));

    return res.json({
      success:      true,
      run_id:       run.id,
      status:       run.status,
      progress:     run.progress,
      result:       run.result,
      error:        run.error,
      created_at:   run.createdAt,
      started_at:   run.startedAt,
      completed_at: run.completedAt,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /runs/:run_id/cancel
 * Request cancellation of a queued or running run.
 */
export async function cancelRunHandler(req, res, next) {
  try {
    const run = cancelRun(req.params.run_id);
    if (!run) return next(new RunNotFoundError(req.params.run_id));

    return res.json({ success: true, run_id: run.id, status: run.status });
  } catch (err) {
    next(err);
  }
}
