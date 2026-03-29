import { callLLMJSON } from "../utils/llm.js";

export async function plannerAgent(userGoal) {
  const systemPrompt = `
You are a planning expert.

Your job is to break a user goal into structured tasks.

========================
RULES
========================

- Extract from the goal:
  - goal (string)
  - duration_days (number)
  - daily_hours (number)

- Break the goal into clear, actionable tasks.

- Each task MUST include:
  - id: "task_1", "task_2" ... sequential
  - title: short name
  - description: one sentence
  - priority: "high" | "medium" | "low"
  - estimated_hours: total hours this task needs across all days (number > 0)
  - dependencies: array of task ids that must be completed first ([] if none)

- CRITICAL: The sum of ALL estimated_hours MUST equal exactly (duration_days × daily_hours).
  Example: 14 days × 3h/day = 42h total. All tasks combined must sum to exactly 42h.

- Tasks must not overlap in scope.
- Order tasks logically: foundations → practice → review/mock.

========================
OUTPUT FORMAT (STRICT)
========================

Return ONLY valid JSON — no markdown, no explanations:

{
  "goal": "...",
  "duration_days": number,
  "daily_hours": number,
  "tasks": [
    {
      "id": "task_1",
      "title": "...",
      "description": "...",
      "priority": "high",
      "estimated_hours": number,
      "dependencies": []
    }
  ]
}
`;

  const plan = await callLLMJSON([
    { role: "system", content: systemPrompt },
    { role: "user", content: `User Goal:\n${userGoal}` },
  ]);

  // Programmatic safeguard: normalize task hours so they sum to exactly the available capacity.
  // This guarantees the optimizer can always build a valid schedule.
  const capacity = plan.duration_days * plan.daily_hours;
  const rawTotal = plan.tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
  if (rawTotal > 0 && Math.abs(rawTotal - capacity) > 0.01) {
    const scale = capacity / rawTotal;
    let allocated = 0;
    plan.tasks.forEach((t, i) => {
      if (i < plan.tasks.length - 1) {
        // Round to 0.5h increments for clean scheduling
        t.estimated_hours = Math.round((t.estimated_hours * scale) * 2) / 2;
        allocated += t.estimated_hours;
      } else {
        // Last task absorbs remainder to ensure exact total
        t.estimated_hours = Math.round((capacity - allocated) * 2) / 2;
      }
    });
  }

  return plan;
}