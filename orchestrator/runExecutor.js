import { plannerAgent }   from "../agents/plannerAgent.js";
import { optimizerAgent } from "../agents/optimizerAgent.js";
import { criticAgent }    from "../agents/criticAgent.js";
import { refinerAgent }   from "../agents/refinerAgent.js";
import { validateSchedule } from "../utils/validator.js";
import { decideNextStep, computeScore } from "./manager.js";
import { MAX_ITERATIONS } from "../config/env.js";

/**
 * Execute a full planning run.
 *
 * @param {string}    goalText     Natural-language goal string.
 * @param {function}  onProgress   Optional callback(progressPatch) for live updates.
 * @param {function}  isCancelled  Optional predicate — return true to stop the loop.
 *
 * @returns {object}  Same shape as the existing run() return value in index.js:
 *   { bestScore, validatorErrors, qualityIssues, suggestions, schedule }
 */
export async function executeRun(goalText, { onProgress, isCancelled } = {}) {
  const cancelled = isCancelled ?? (() => false);
  const emit = (patch) => onProgress?.(patch);

  // ── Step 1: Plan ───────────────────────────────────────────────────────────
  const plan = await plannerAgent(goalText);
  const totalEstimated = plan.tasks.reduce((s, t) => s + t.estimated_hours, 0);
  const capacity        = plan.duration_days * plan.daily_hours;
  console.log(`\n🧠 Planned ${plan.tasks.length} tasks  ${plan.duration_days}d × ${plan.daily_hours}h  (${totalEstimated}h / ${capacity}h)`);

  // ── Step 2: Initial schedule ───────────────────────────────────────────────
  let schedule = await optimizerAgent(plan);

  const state = {
    iteration:    0,
    lastAction:   null,
    lastScore:    0,
    bestScore:    -Infinity,
    bestSchedule: null,
    bestReview:   null,
    bestValidation: null,
  };

  emit({ progress: { iteration: 0, maxIterations: MAX_ITERATIONS } });

  // ── Step 3: Evaluate → Decide → Act loop ──────────────────────────────────
  while (state.iteration < MAX_ITERATIONS) {
    if (cancelled()) break;

    state.iteration++;
    console.log(`\n${"─".repeat(52)}`);
    console.log(`📍 Iteration ${state.iteration}/${MAX_ITERATIONS}`);

    emit({ progress: { iteration: state.iteration, maxIterations: MAX_ITERATIONS } });

    const validation = validateSchedule(plan, schedule);
    console.log(`  🔍 Validator: ${validation.errorCount} error(s)`);
    validation.errors.forEach(e => console.log(`     ✗ [${e.type}] ${e.message}`));

    let review = null;
    let currentScore = 0;
    if (validation.errorCount === 0) {
      review = await criticAgent(plan, schedule, validation.errors);
      currentScore = computeScore(review, validation.errors);
      console.log(`  📊 Critic: ${review.score}/10  →  effective: ${currentScore.toFixed(1)}`);
      review.issues.forEach(i => console.log(`     ⚠ ${i.message}`));
    } else {
      console.log(`  ⏭  Skipping critic — validator errors must be resolved first`);
    }

    if (validation.errorCount === 0 && currentScore > state.bestScore) {
      state.bestScore      = currentScore;
      state.bestSchedule   = schedule;
      state.bestReview     = review;
      state.bestValidation = validation;
      console.log(`  ⭐ New best: ${currentScore.toFixed(1)}`);
    }

    const decision = decideNextStep({
      validatorErrors: validation.errors,
      review,
      currentScore,
      lastScore:    state.lastScore,
      iteration:    state.iteration,
      lastAction:   state.lastAction,
    });
    console.log(`  🎯 Manager → ${decision.action}: ${decision.reason}`);

    state.lastScore  = currentScore;
    state.lastAction = decision.action;

    if (decision.action === "STOP") break;

    if (decision.action === "OPTIMIZE") {
      schedule = await optimizerAgent(plan, schedule, validation.errors);
    } else if (decision.action === "REFINE") {
      schedule = await refinerAgent(plan, schedule, {
        validatorErrors: validation.errors,
        criticIssues:    review.issues,
        suggestions:     review.suggestions ?? [],
        currentScore,
      });
    }
  }

  // ── Final output ────────────────────────────────────────────────────────── 
  const finalSchedule  = state.bestSchedule  ?? schedule;
  const finalReview    = state.bestReview;
  const finalValidation = state.bestValidation;

  console.log("\n" + "=".repeat(52));
  console.log(`Best score:          ${state.bestScore > -Infinity ? state.bestScore.toFixed(1) : "N/A"}`);
  console.log(`Validator errors:    ${finalValidation?.errorCount ?? "N/A"}`);
  console.log(`Quality issues:      ${finalReview?.issues?.length ?? "N/A"}`);

  return {
    bestScore:       state.bestScore > -Infinity ? parseFloat(state.bestScore.toFixed(1)) : null,
    validatorErrors: finalValidation?.errorCount ?? null,
    qualityIssues:   finalReview?.issues?.length ?? null,
    suggestions:     finalReview?.suggestions ?? [],
    schedule:        finalSchedule,
  };
}
