import { callLLMJSON } from "../utils/llm.js";
import { validateSchedule } from "../utils/schemaValidator.js";

/**
 * Optimizer agent — two modes:
 *   FRESH (default): schedule = null  → generate a valid schedule from scratch.
 *   FIX mode:        schedule + validatorErrors provided → fix specific violations only.
 *
 * @param {object}   plan
 * @param {object}   [schedule=null]        - existing schedule to fix (FIX mode)
 * @param {Array}    [validatorErrors=[]]   - violations to correct (FIX mode)
 */
export async function optimizerAgent(plan, schedule = null, validatorErrors = []) {
  const { duration_days, daily_hours } = plan;
  const isFixMode = schedule !== null && validatorErrors.length > 0;

  const modeSection = isFixMode
    ? `
========================
FIX MODE
========================

The schedule below has constraint violations that MUST be corrected.
Fix ONLY the violations listed. Preserve the rest of the schedule where already correct.

Violations to fix:
${JSON.stringify(validatorErrors, null, 2)}

Current Schedule (fix this):
${JSON.stringify(schedule)}
`
    : `
========================
GENERATE MODE
========================

Generate a fresh schedule from scratch that satisfies all constraints.
`;

  const systemPrompt = `
You are an expert schedule optimizer.
${isFixMode
  ? "Your job is to fix specific constraint violations in an existing schedule."
  : "Your job is to convert a plan into a valid day-by-day schedule."}

========================
CONSTRAINTS (must ALL be satisfied)
========================

- Duration: exactly ${duration_days} days (day_1 through day_${duration_days})
- Daily hour limit: ${daily_hours}h per day — NEVER exceed this
- Every task must be scheduled — spread estimated_hours across one or more days
- Dependencies: if task B depends on task A, A must finish before B starts
- No day may be empty — every day must have at least one slot
- No slot may have 0 hours

========================
STRATEGY
========================

- Distribute workload evenly (aim for ~${daily_hours}h per day)
- Schedule foundational / high-priority tasks earlier
- Schedule review / mock sessions toward the end
- A task can be split across multiple days
${modeSection}
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

  const result = await callLLMJSON([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Plan:\n${JSON.stringify(plan)}` },
  ]);
  validateSchedule(result);
  return result;
}