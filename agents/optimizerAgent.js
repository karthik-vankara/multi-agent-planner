import { callLLMJSON } from "../utils/llm.js";

export async function optimizerAgent(plan) {
  const { goal, duration_days, daily_hours, tasks } = plan;

  const systemPrompt = `
You are an expert schedule optimizer.

You will receive a plan with tasks. Convert them into a day-by-day schedule.

========================
CONSTRAINTS (must ALL be satisfied)
========================

- Duration: exactly ${duration_days} days (day_1 through day_${duration_days})
- Daily hour limit: ${daily_hours}h per day — NEVER exceed this
- Every task must be scheduled with its full estimated_hours spread across one or more days
- If task B depends on task A, task A must finish (last scheduled day) BEFORE task B starts (first scheduled day)
- No day may be empty — every day must have at least one task slot
- No slot may have 0 hours

========================
STRATEGY
========================

- Distribute workload evenly across all ${duration_days} days (aim for close to ${daily_hours}h each day)
- Schedule foundational / high-priority tasks earlier
- Schedule review / practice tasks toward the end
- A task can be split across multiple days if needed

========================
EXAMPLE (3 days, 2h/day)
========================

{
  "schedule": {
    "day_1": [{ "task_id": "task_1", "hours": 2 }],
    "day_2": [{ "task_id": "task_1", "hours": 1 }, { "task_id": "task_2", "hours": 1 }],
    "day_3": [{ "task_id": "task_2", "hours": 1 }, { "task_id": "task_3", "hours": 1 }]
  }
}

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

  return callLLMJSON([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Plan:\n${JSON.stringify(plan)}` },
  ]);
}