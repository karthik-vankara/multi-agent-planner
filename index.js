import { plannerAgent } from "./agents/plannerAgent.js";
import { optimizerAgent } from "./agents/optimizerAgent.js";
import { criticAgent } from "./agents/criticAgent.js";
import { refinerAgent } from "./agents/refinerAgent.js";
import { validateSchedule } from "./utils/validator.js";

const MAX_REFINEMENTS = 3;

async function run() {
  const goal =
    "I want to prepare for a coding interview in 14 days with 3 hours daily";

  // Step 1: Plan
  console.log("\n🧠 Planning...");
  const plan = await plannerAgent(goal);
  console.log(`  → ${plan.tasks.length} tasks, ${plan.duration_days} days, ${plan.daily_hours}h/day`);

  // Step 2: Optimize
  console.log("\n📅 Generating schedule...");
  let schedule = await optimizerAgent(plan);

  // Step 3: Validate + Critique
  let validation = validateSchedule(plan, schedule);
  console.log(`  → Validator: ${validation.errorCount} errors`);
  if (validation.errors.length > 0) {
    validation.errors.forEach((e) => console.log(`    ✗ [${e.type}] ${e.message}`));
  }

  let review = await criticAgent(plan, schedule, validation.errors);
  console.log(`  → Critic score: ${review.score}/10`);
  if (review.issues.length > 0) {
    review.issues.forEach((i) => console.log(`    ⚠ ${i.message}`));
  }

  // Track best result
  let bestSchedule = schedule;
  let bestValidation = validation;
  let bestReview = review;
  let bestTotal = review.score - validation.errorCount * 0.5;

  // Step 4: Refinement loop
  for (let attempt = 1; attempt <= MAX_REFINEMENTS; attempt++) {
    console.log(`\n🔄 Refinement ${attempt}/${MAX_REFINEMENTS}...`);

    const newSchedule = await refinerAgent(plan, schedule, {
      validatorErrors: validation.errors,
      criticIssues: review.issues,
      suggestions: review.suggestions || [],
      currentScore: review.score,
    });

    const newValidation = validateSchedule(plan, newSchedule);
    console.log(`  → Validator: ${newValidation.errorCount} errors`);
    if (newValidation.errors.length > 0) {
      newValidation.errors.forEach((e) => console.log(`    ✗ [${e.type}] ${e.message}`));
    }

    const newReview = await criticAgent(plan, newSchedule, newValidation.errors);
    console.log(`  → Critic score: ${newReview.score}/10`);
    if (newReview.issues.length > 0) {
      newReview.issues.forEach((i) => console.log(`    ⚠ ${i.message}`));
    }

    // Accept if overall quality improved (score minus penalty for validator errors)
    const newTotal = newReview.score - newValidation.errorCount * 0.5;
    if (newTotal > bestTotal) {
      console.log(`  ✅ Accepted (${bestTotal.toFixed(1)} → ${newTotal.toFixed(1)})`);
      bestSchedule = newSchedule;
      bestValidation = newValidation;
      bestReview = newReview;
      bestTotal = newTotal;
      // Feed improved schedule forward for next refinement
      schedule = newSchedule;
      validation = newValidation;
      review = newReview;
    } else {
      console.log(`  ❌ Rejected (would be ${newTotal.toFixed(1)}, best is ${bestTotal.toFixed(1)})`);
    }
  }

  // Final output
  console.log("\n" + "=".repeat(50));
  console.log("=== FINAL RESULT ===");
  console.log("=".repeat(50));
  console.log(`\nScore: ${bestReview.score}/10`);
  console.log(`Validator errors: ${bestValidation.errorCount}`);
  console.log(`Quality issues: ${bestReview.issues.length}`);
  console.log(`\nSchedule:\n${JSON.stringify(bestSchedule, null, 2)}`);
}

run().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});
