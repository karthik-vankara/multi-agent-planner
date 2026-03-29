/**
 * Manager — the control layer of the multi-agent planning system.
 *
 * Responsibilities:
 *   1. computeScore()    — combine LLM critic score + validator penalty into one number
 *   2. decideNextStep()  — decide the next action based on current system state
 *
 * Decision priority:
 *   1. Validator errors exist  → OPTIMIZE (fix hard constraints first)
 *   2. Score >= 8              → STOP    (quality target met)
 *   3. Stagnating (iter > 2)   → STOP    (no improvement, give up)
 *   4. Default                 → REFINE  (still room to improve)
 */

/**
 * Combine critic score and validator error count into a single effective score.
 * Each validator error subtracts 0.5 from the raw critic score.
 *
 * @param {object} review          - criticAgent output { score, issues, suggestions }
 * @param {Array}  validatorErrors - errors from validateSchedule()
 * @returns {number}
 */
export function computeScore(review, validatorErrors = []) {
  return review.score - validatorErrors.length * 0.5;
}

/**
 * Decide what the orchestrator should do next.
 *
 * @param {object}      context
 * @param {Array}       context.validatorErrors - current validator errors
 * @param {object|null} context.review          - criticAgent output, null when errors exist
 * @param {number}      context.currentScore    - effective score this iteration
 * @param {number}      context.lastScore       - effective score previous iteration
 * @param {number}      context.iteration       - current iteration number (1-based)
 * @param {string|null} context.lastAction      - action taken last iteration
 *
 * @returns {{ action: "OPTIMIZE" | "REFINE" | "STOP", reason: string }}
 */
export function decideNextStep({ validatorErrors, review, currentScore, lastScore, iteration, lastAction }) {
  // Priority 1: Hard constraint violations must be fixed before quality evaluation
  if (validatorErrors.length > 0) {
    return {
      action: "OPTIMIZE",
      reason: `${validatorErrors.length} validator error(s) must be resolved before quality can be assessed`,
    };
  }

  // Priority 2: Quality target met — stop
  if (currentScore >= 8) {
    return {
      action: "STOP",
      reason: `Score ${currentScore.toFixed(1)} meets the quality target (≥8)`,
    };
  }

  // Priority 3: Stagnation — score not improving after 2+ iterations
  if (iteration > 2 && currentScore <= lastScore) {
    return {
      action: "STOP",
      reason: `Stagnating after ${iteration} iterations — score ${currentScore.toFixed(1)} did not improve from ${lastScore.toFixed(1)}`,
    };
  }

  // Default: Still improving, continue refining
  return {
    action: "REFINE",
    reason: `Score ${currentScore.toFixed(1)} is below target — refining for quality improvement`,
  };
}
