import { callLLM } from "../utils/llm.js";

export async function plannerAgent(userGoal) {
  const systemPrompt = `
You are a planning expert.

Your job is to break a user goal into structured tasks.

========================
RULES
========================

- Extract:
  - goal
  - duration in days
  - daily available hours

- Break goal into clear, actionable tasks

- Each task must include:
  - id (task_1, task_2...)
  - title
  - description
  - priority (high | medium | low)
  - estimated_hours (number)
  - dependencies (array of task ids)

- Tasks should:
  - cover the full goal
  - not overlap
  - be logically ordered via dependencies

STRICTLY ensure:
- total hours per day ≤ daily_hours
- all days from day_1 to day_N are present

========================
OUTPUT FORMAT (STRICT)
========================

Return ONLY valid JSON:

{
  "goal": "...",
  "duration_days": number,
  "daily_hours": number,
  "tasks": [...]
}

Do NOT include explanations or markdown.
`;

  const userPrompt = `
User Goal:
${userGoal}
`;

  const response = await callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]);

  try {
    return JSON.parse(response);
  } catch (err) {
    console.error("Planner Agent JSON parse failed:", response);
    throw new Error("Invalid JSON from Planner Agent");
  }
}