import { plannerAgent } from "./agents/plannerAgent.js";
import { optimizerAgent } from "./agents/optimizerAgent.js";
import { criticAgent } from "./agents/criticAgent.js";
import { refinerAgent } from "./agents/refinerAgent.js";
import { validateSchedule } from "./utils/validator.js";
import { decideNextStep, computeScore } from "./orchestrator/manager.js";

const MAX_ITERATIONS = 7;

async function run() {
  const goal =
    "I want to prepare for a coding interview in 14 days with 3 hours daily";

  // ── Step 1: Plan ───────────────────────────────────────────────────────────
  console.log("\n🧠 Planning...");
  const plan = await plannerAgent(goal);
  const totalEstimated = plan.tasks.reduce((s, t) => s + t.estimated_hours, 0);
  const capacity = plan.duration_days * plan.daily_hours;
  console.log(`  → ${plan.tasks.length} tasks, ${plan.duration_days} days, ${plan.daily_hours}h/day, total estimated: ${totalEstimated}h / ${capacity}h capacity`);

  // ── Step 2: Generate initial schedule ─────────────────────────────────────
  console.log("\n📅 Generating initial schedule...");
  let schedule = await optimizerAgent(plan);

  // ── Step 3: State ─────────────────────────────────────────────────────────
  let state = {
    iteration: 0,
    lastAction: null,
    lastScore: 0,
    bestScore: -Infinity,
    bestSchedule: null,
    bestReview: null,
    bestValidation: null,
  };

  // ── Step 4: Manager loop — Evaluate → Decide → Act ────────────────────────
  while (state.iteration < MAX_ITERATIONS) {
    state.iteration++;
    console.log(`\n${"─".repeat(52)}`);
    console.log(`📍 Iteration ${state.iteration}/${MAX_ITERATIONS}`);

    // Validate (always — code-based, zero LLM cost)
    const validation = validateSchedule(plan, schedule);
    console.log(`  🔍 Validator: ${validation.errorCount} error(s)`);
    if (validation.errors.length > 0) {
      validation.errors.forEach((e) => console.log(`     ✗ [${e.type}] ${e.message}`));
    }

    // Critique — ONLY when schedule is constraint-clean
    let review = null;
    let currentScore = 0;
    if (validation.errorCount === 0) {
      review = await criticAgent(plan, schedule, validation.errors);
      currentScore = computeScore(review, validation.errors);
      console.log(`  📊 Critic: ${review.score}/10  →  effective score: ${currentScore.toFixed(1)}`);
      if (review.issues.length > 0) {
        review.issues.forEach((i) => console.log(`     ⚠ ${i.message}`));
      }
    } else {
      console.log(`  ⏭  Skipping critic — validator errors must be resolved first`);
    }

    // Track best (only valid schedules qualify)
    if (validation.errorCount === 0 && currentScore > state.bestScore) {
      state.bestScore = currentScore;
      state.bestSchedule = schedule;
      state.bestReview = review;
      state.bestValidation = validation;
      console.log(`  ⭐ New best: ${currentScore.toFixed(1)}`);
    }

    // Decide
    const decision = decideNextStep({
      validatorErrors: validation.errors,
      review,
      currentScore,
      lastScore: state.lastScore,
      iteration: state.iteration,
      lastAction: state.lastAction,
    });
    console.log(`  🎯 Manager → ${decision.action}: ${decision.reason}`);

    // Update state before acting
    state.lastScore = currentScore;
    state.lastAction = decision.action;

    // Act
    if (decision.action === "STOP") {
      break;
    } else if (decision.action === "OPTIMIZE") {
      console.log(`  🔧 Optimizing — fixing constraint violations...`);
      schedule = await optimizerAgent(plan, schedule, validation.errors);
    } else if (decision.action === "REFINE") {
      console.log(`  ✏️  Refining — improving quality...`);
      schedule = await refinerAgent(plan, schedule, {
        validatorErrors: validation.errors,
        criticIssues: review.issues,
        suggestions: review.suggestions || [],
        currentScore,
      });
    }
  }

  // ── Final Output ──────────────────────────────────────────────────────────
  const finalSchedule = state.bestSchedule ?? schedule;
  const finalReview = state.bestReview;
  const finalValidation = state.bestValidation;

  console.log("\n" + "=".repeat(52));
  console.log("=== FINAL RESULT ===");
  console.log("=".repeat(52));
  console.log(`\nBest effective score : ${state.bestScore > -Infinity ? state.bestScore.toFixed(1) : "N/A"}`);
  console.log(`Validator errors     : ${finalValidation?.errorCount ?? "N/A"}`);
  console.log(`Quality issues       : ${finalReview?.issues?.length ?? "N/A"}`);
  if (finalReview?.suggestions?.length > 0) {
    console.log(`\nSuggestions:`);
    finalReview.suggestions.forEach((s) => console.log(`  • ${s}`));
  }
  console.log(`\nSchedule:\n${JSON.stringify(finalSchedule, null, 2)}`);
}

run().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});
