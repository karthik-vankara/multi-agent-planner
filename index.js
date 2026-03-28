import { callLLM } from "./utils/llm.js";
import { plannerAgent } from "./agents/plannerAgent.js";
import { optimizerAgent } from "./agents/optimizerAgent.js";
import { criticAgent } from "./agents/criticAgent.js";
import { refinerAgent } from "./agents/refinerAgent.js";
import { addAttempt } from "./utils/memory.js";
import { addLearning } from "./utils/memory.js";

async function test() {
  const res = await callLLM([
    { role: "system", content: "Say hello" },
    { role: "user", content: "Test connection" },
  ]);

  console.log(res);
}
// test();

async function run() {
  const goal =
    "I want to prepare for a coding interview in 14 days with 3 hours daily";

  const plan = await plannerAgent(goal);

  let schedule = await optimizerAgent(plan);

  let review = await criticAgent(plan, schedule);

  console.log("Initial Score:", review.score);

  let attempts = 0;

  let bestSchedule = schedule;
  let bestScore = review.score;

  while (attempts < 3) {
    console.log(`\nRefinement Attempt ${attempts + 1}...`);

    const newSchedule = await refinerAgent(plan, schedule, review.issues);
    const newReview = await criticAgent(plan, newSchedule);

    console.log("New Score:", newReview.score);

    // ✅ Only accept if better
    if (newReview.score > bestScore && newReview.issues.length <= review.issues.length) {
      newReview.learnings?.forEach(l=>addLearning(l));
      bestScore = newReview.score;
      bestSchedule = newSchedule;
      schedule = newSchedule;
      review = newReview;
    } else {
      console.log("Rejected worse schedule");
    }

    attempts++;
  }

  console.log("\n=== FINAL OUTPUT ===");
  console.log(JSON.stringify(schedule, null, 2));
  console.log("\nFinal Score:", review.score);
}

run();
