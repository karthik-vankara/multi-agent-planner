// ── Config must be imported first so env vars are loaded before any other module ──
import "./config/env.js";

import { executeRun } from "./orchestrator/runExecutor.js";

/**
 * Thin re-export used by legacy callers (e.g. tests) that import { run } from index.js.
 * All orchestration logic now lives in orchestrator/runExecutor.js.
 */
export const run = executeRun;

// ── CLI entry point ──────────────────────────────────────────────────────────
// Only execute when this file is run directly (not imported by api.js)
const isMain = process.argv[1]?.endsWith("index.js");

if (isMain) {
  import("yargs").then(({ default: yargs }) =>
    import("yargs/helpers").then(({ hideBin }) => {
      const argv = yargs(hideBin(process.argv))
        .usage("Usage: node index.js [--goal <text>] [--days <n>] [--hours <n>]")
        .option("goal", {
          alias: "g",
          type: "string",
          description: "Your planning goal (natural language)",
        })
        .option("days", {
          alias: "d",
          type: "number",
          description: "Duration in days (overrides days mentioned in --goal)",
        })
        .option("hours", {
          alias: "h",
          type: "number",
          description: "Daily hours available (overrides hours mentioned in --goal)",
        })
        .help()
        .argv;

      // Build the goal string from flags or positional arg
      let goalText = argv.goal || argv._[0];

      if (!goalText) {
        console.error("❌  Please provide a goal.\n");
        console.error("  Example: node index.js --goal \"Build a REST API\" --days 7 --hours 4");
        console.error("  Example: node index.js \"Prepare for coding interview in 14 days with 3 hours daily\"\n");
        process.exit(1);
      }

      // Append structured overrides if provided
      if (argv.days)  goalText += ` in ${argv.days} days`;
      if (argv.hours) goalText += ` with ${argv.hours} hours daily`;

      console.log(`\n🎯 Goal: "${goalText}"`);

      run(goalText).catch((err) => {
        console.error("\n💥 Fatal error:", err.message);
        process.exit(1);
      });
    })
  );
}
