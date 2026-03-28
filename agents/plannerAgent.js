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

- The sum of all estimated_hours MUST equal duration_days × daily_hours.
- Tasks must not overlap in scope.
- Order tasks logically using dependencies (foundations first, practice later, review last).

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

  return callLLMJSON([
    { role: "system", content: systemPrompt },
    { role: "user", content: `User Goal:\n${userGoal}` },
  ]);
}