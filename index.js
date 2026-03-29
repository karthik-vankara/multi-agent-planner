import { plannerAgent } from "./agents/plannerAgent.js";
import { optimizerAgent } from "./agents/optimizerAgent.js";
import { criticAgent } from "./agents/criticAgent.js";
import { refinerAgent } from "./agents/refinerAgent.js";
import { validateSchedule } from "./utils/validator.js";
import { decideNextStep, computeScore } from "./orchestrator/manager.js";

const MAX_ITERATIONS = 7;

export async function run(goal) {

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

  return {
    bestScore: state.bestScore > -Infinity ? parseFloat(state.bestScore.toFixed(1)) : null,
    validatorErrors: finalValidation?.errorCount ?? null,
    qualityIssues: finalReview?.issues?.length ?? null,
    suggestions: finalReview?.suggestions ?? [],
    schedule: finalSchedule,
  };
}

// ── CLI entry point ──────────────────────────────────────────────────────────
// Only execute when this file is run directly (not imported by api.js)
const isMain = process.argv[1]?.endsWith("index.js");

if (isMain) {
  import("yargs").then(({ default: yargs }) =>
    import("yargs/helpers").then(({ hideBin }) => {
      const argv = yargs(hideBin(process.argv))
        .usage("Usage: node index.js [--goal <text>] [--days <n>] [--hours <n>]")
        .option("goal", {
          alias: "g",
          type: "string",
          description: "Your planning goal (natural language)",
        })
        .option("days", {
          alias: "d",
          type: "number",
          description: "Duration in days (overrides days mentioned in --goal)",
        })
        .option("hours", {
          alias: "h",
          type: "number",
          description: "Daily hours available (overrides hours mentioned in --goal)",
        })
        .help()
        .argv;

      // Build the goal string from flags or positional arg
      let goalText = argv.goal || argv._[0];

      if (!goalText) {
        console.error("❌  Please provide a goal.\n");
        console.error("  Example: node index.js --goal \"Build a REST API\" --days 7 --hours 4");
        console.error("  Example: node index.js \"Prepare for coding interview in 14 days with 3 hours daily\"\n");
        process.exit(1);
      }

      // Append structured overrides if provided
      if (argv.days)  goalText += ` in ${argv.days} days`;
      if (argv.hours) goalText += ` with ${argv.hours} hours daily`;

      console.log(`\n🎯 Goal: "${goalText}"`);

      run(goalText).catch((err) => {
        console.error("\n💥 Fatal error:", err.message);
        process.exit(1);
      });
    })
  );
}
