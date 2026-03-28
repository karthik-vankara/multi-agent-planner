import { callLLM } from "../utils/llm.js";
import { getLearnings } from "../utils/memory.js";

const learnings = getLearnings();

export async function refinerAgent(plan, schedule, issues) {
  const systemPrompt = `
You are a planning refiner.

Your job is to FIX the given schedule based on identified issues.

========================
RULES
========================

- You are given:
  - original plan
  - current schedule
  - list of issues

- You MUST:
  - fix ALL issues
  - ensure all tasks are scheduled
  - respect dependencies
  - respect daily hour limits
  - distribute tasks evenly

- You MUST NOT:
  - remove tasks
  - ignore issues
  - exceed constraints

Previous Learnings:
${JSON.stringify(learnings)}

Use these learnings to improve the schedule.

In addition to fixing issues:
- Use suggestions to IMPROVE overall quality
- Aim for a near-perfect plan (score 9+)
- Improve balance and logical flow

IMPORTANT:

- Make MINIMAL changes to fix issues
- Do NOT restructure entire schedule
- Preserve parts that are already correct
- Avoid introducing new issues

========================
OUTPUT FORMAT (STRICT)
========================

Return ONLY valid JSON:

{
  "goal": "...",
  "schedule": {
    "day_1": [
      { "task_id": "...", "hours": number }
    ]
  }
}
`;

  const userPrompt = `
Plan:
${JSON.stringify(plan)}

Current Schedule:
${JSON.stringify(schedule)}

Issues:
${JSON.stringify(issues)}
`;

  const response = await callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]);

  try {
    return JSON.parse(response);
  } catch (err) {
    console.error("Refiner Agent JSON parse failed:", response);
    throw new Error("Invalid JSON from Refiner Agent");
  }
}