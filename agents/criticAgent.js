import { callLLM } from "../utils/llm.js";

export async function criticAgent(plan, schedule) {
  const systemPrompt = `
You are a strict planning critic.

Your job is to analyze a plan and its schedule and identify problems.

========================
CHECK FOR:
========================

1. Constraint violations:
   - Days exceed duration
   - Daily hours exceed limit

2. Logical issues:
   - Dependencies not respected
   - Tasks scheduled in wrong order

3. Quality issues:
   - Uneven workload
   - Empty days
   - Overloaded days

4. Completeness:
   - Missing tasks
   - Tasks not scheduled

SCORING RULES:

- 9–10 → near perfect, no meaningful improvements needed
- 7–8 → good but still has noticeable issues
- 5–6 → average, multiple problems
- <5 → poor
Be STRICT. Most plans should NOT exceed 8.


Also extract reusable learnings:

Example:
- "Always ensure all tasks are scheduled"
- "Avoid assigning 0-hour tasks"

========================
OUTPUT FORMAT (STRICT)
========================

Return ONLY valid JSON:

{
  "issues": [
    {
      "type": "constraint_violation | dependency_issue | quality_issue | completeness_issue",
      "message": "..."
    }
  ],
  "suggestions": [
    "Distribute workload more evenly",
    "Move mock interviews to last 3 days"
  ],
  "learnings": [...],
  "score": number
}

- No explanations

`;

  const userPrompt = `
Plan:
${JSON.stringify(plan)}

Schedule:
${JSON.stringify(schedule)}
`;

  const response = await callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]);

  try {
    return JSON.parse(response);
  } catch (err) {
    console.error("Critic Agent JSON parse failed:", response);
    throw new Error("Invalid JSON from Critic Agent");
  }
}