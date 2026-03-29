import { callLLMJSON } from "../utils/llm.js";
import { validateReview } from "../utils/schemaValidator.js";

/**
 * Critic agent — evaluates QUALITY only.
 * Hard constraint checking is handled by the programmatic validator.
 * @param {object} plan
 * @param {object} schedule
 * @param {object[]} validatorErrors - errors from utils/validator.js
 */
export async function criticAgent(plan, schedule, validatorErrors = []) {
  const systemPrompt = `
You are a strict planning quality reviewer.

A separate validator has already checked hard constraints (hour limits, missing days, dependencies).
Those validator errors are provided below — do NOT re-check them. Focus ONLY on subjective quality.

========================
EVALUATE THESE QUALITY DIMENSIONS
========================

1. Workload balance:
   - Are hours distributed evenly across days, or are some days packed and others light?

2. Logical flow:
   - Are foundational topics scheduled before advanced ones?
   - Is there progressive difficulty?

3. Pedagogical quality:
   - Is there time for review / revision toward the end?
   - Are practice / mock sessions placed after learning sessions?

4. Task allocation:
   - Does each task get enough time relative to its priority?
   - Are high-priority tasks given more focus?

========================
SCORING RUBRIC (be strict and consistent)
========================

- Start at 10. Deduct points:
  - Each validator error: −0.5 (they are listed below for your reference)
  - Major quality issue (e.g. all practice on day 1): −1.0
  - Minor quality issue (e.g. slightly uneven load): −0.5
  - Minimum score: 1

========================
OUTPUT FORMAT (STRICT)
========================

Return ONLY valid JSON — no markdown, no explanations:

{
  "issues": [
    { "type": "quality_issue", "message": "..." }
  ],
  "suggestions": [
    "Actionable improvement 1",
    "Actionable improvement 2"
  ],
  "score": number
}
`;

  const userPrompt = `
Plan:
${JSON.stringify(plan)}

Schedule:
${JSON.stringify(schedule)}

Validator Errors (already caught — do not repeat, but factor into score):
${JSON.stringify(validatorErrors)}
`;

  const result = await callLLMJSON([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  validateReview(result);
  return result;
}