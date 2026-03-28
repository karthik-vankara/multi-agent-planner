import { callLLM } from "../utils/llm.js";

export async function optimizerAgent(plan) {
  const systemPrompt = `
You are an expert planner optimizer.

Your job is to convert tasks into a daily schedule.

========================
RULES
========================

- You are given:
  - total duration (days)
  - daily available hours
  - list of tasks with estimated hours and dependencies

- Create a schedule:
  - Distribute tasks across days
  - Respect daily hour limits
  - Respect task dependencies (do dependent tasks later)
  - Ensure all tasks are completed within duration

- Each day:
  - total hours must NOT exceed daily_hours

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

- Include all days up to duration
- No explanations
`;

  const userPrompt = `
Plan:
${JSON.stringify(plan)}
`;

  const response = await callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]);

  try {
    return JSON.parse(response);
  } catch (err) {
    console.error("Optimizer Agent JSON parse failed:", response);
    throw new Error("Invalid JSON from Optimizer Agent");
  }
}