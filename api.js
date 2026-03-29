import express from "express";
import { run } from "./index.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/**
 * POST /plan
 *
 * Body (JSON):
 *   goal   {string}  required — natural language planning goal OR base description
 *   days   {number}  optional — duration override (appended to goal string)
 *   hours  {number}  optional — daily hours override (appended to goal string)
 *
 * Response (JSON):
 *   { success: true,  result: { bestScore, validatorErrors, qualityIssues, suggestions, schedule } }
 *   { success: false, error: "..." }
 */
app.post("/plan", async (req, res) => {
  const { goal, days, hours } = req.body ?? {};

  if (!goal || typeof goal !== "string" || goal.trim() === "") {
    return res.status(400).json({ success: false, error: "Field 'goal' is required and must be a non-empty string." });
  }

  if (days !== undefined && (typeof days !== "number" || days < 1 || days > 365)) {
    return res.status(400).json({ success: false, error: "'days' must be a number between 1 and 365." });
  }

  if (hours !== undefined && (typeof hours !== "number" || hours < 0.5 || hours > 24)) {
    return res.status(400).json({ success: false, error: "'hours' must be a number between 0.5 and 24." });
  }

  // Build goal string — same construction as CLI
  let goalText = goal.trim();
  if (days)  goalText += ` in ${days} days`;
  if (hours) goalText += ` with ${hours} hours daily`;

  console.log(`\n[API] POST /plan — goal: "${goalText}"`);

  try {
    const result = await run(goalText);
    res.json({ success: true, result });
  } catch (err) {
    console.error("[API] Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Multi-Agent Planner API running on http://localhost:${PORT}`);
  console.log(`   POST /plan  { goal, days?, hours? }`);
  console.log(`   GET  /health\n`);
});
