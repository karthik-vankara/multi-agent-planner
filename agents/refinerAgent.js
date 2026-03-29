import { callLLMJSON } from "../utils/llm.js";
import { validateSchedule } from "../utils/schemaValidator.js";

/**
 * Refiner agent — receives full context: validator errors, critic feedback, score, and suggestions.
 * Priority: fix validator errors first, then improve quality.
 */
export async function refinerAgent(plan, schedule, { validatorErrors, criticIssues, suggestions, currentScore }) {
  const { duration_days, daily_hours } = plan;

  const systemPrompt = `
You are a schedule refiner.

You will receive a schedule along with two types of feedback:
1. VALIDATOR ERRORS — hard constraint violations found by code (MUST be fixed)
2. CRITIC ISSUES — subjective quality problems (should be improved)
3. SUGGESTIONS — specific actionable improvements from the critic

The current score is ${currentScore}/10.

========================
PRIORITY ORDER
========================

1. Fix ALL validator errors first — these are objective and non-negotiable:
   - Every day from day_1 to day_${duration_days} must exist
   - Each day's total hours must be ≤ ${daily_hours}
   - Every task in the plan must be scheduled
   - No zero-hour slots
   - Dependencies must be respected (dependency finishes before dependent starts)
   - Each task should get hours close to its estimated_hours

2. Then address critic issues and suggestions to improve quality:
   - Balance workload evenly
   - Ensure logical progression (foundations → practice → review)
   - Place revision and mock sessions toward the end

========================
RULES
========================

- Do NOT remove any tasks
- Do NOT add tasks that aren't in the plan
- Do NOT exceed ${daily_hours}h on any day
- A task CAN be split across multiple days
- Keep parts of the schedule that are already correct

========================
OUTPUT FORMAT (STRICT)
========================

Return ONLY valid JSON — no markdown, no explanations:

{
  "goal": "...",
  "schedule": {
    "day_1": [{ "task_id": "...", "hours": number }],
    ...
  }
}
`;

  const userPrompt = `
Plan:
${JSON.stringify(plan)}

Current Schedule:
${JSON.stringify(schedule)}

Validator Errors (MUST fix):
${JSON.stringify(validatorErrors)}

Critic Issues:
${JSON.stringify(criticIssues)}

Suggestions:
${JSON.stringify(suggestions)}
`;

  const result = await callLLMJSON([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  validateSchedule(result);
  return result;
}