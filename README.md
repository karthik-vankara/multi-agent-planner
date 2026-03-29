# Multi-Agent Planner

Multi-Agent Planner is a Node.js app that turns a natural-language goal into a day-by-day schedule using a multi-agent loop.

It supports:
- CLI usage (`node index.js ...`)
- HTTP API usage (async `POST /runs` + `GET /runs/:id` polling)

## How It Works

The runtime pipeline is implemented in `orchestrator/runExecutor.js`:

1. `plannerAgent` converts the goal into a structured plan (`tasks`, `duration_days`, `daily_hours`) and validates the output against `schemas/plan.json`.
2. `optimizerAgent` generates an initial schedule validated against `schemas/schedule.json`.
3. `validateSchedule` performs deterministic constraint checks in code.
4. `criticAgent` evaluates quality only when validator errors are `0`, output validated against `schemas/review.json`.
5. `manager` decides next action (`OPTIMIZE`, `REFINE`, or `STOP`).
6. `refinerAgent` improves the schedule when quality is below target.

The loop runs for up to **7 iterations** (configurable via `MAX_ITERATIONS`) and returns the best valid schedule found.

## Decision Logic

`orchestrator/manager.js` applies this priority:

1. Validator errors exist -> `OPTIMIZE`
2. Effective score >= 8 -> `STOP`
3. Score stagnates after iteration 2 -> `STOP`
4. Otherwise -> `REFINE`

Effective score formula:

```text
effective_score = critic_score - (validator_error_count * 0.5)
```

## Validator Rules

`utils/validator.js` checks hard constraints programmatically, including:

- missing/extra days
- daily hour overflow
- empty days
- zero-hour slots
- unknown task IDs
- unscheduled tasks
- dependency violations
- under-allocated tasks (scheduled < 50% of estimated)

## Project Structure

```text
.
├── agents/
│   ├── plannerAgent.js
│   ├── optimizerAgent.js
│   ├── criticAgent.js
│   └── refinerAgent.js
├── config/
│   └── env.js               ← centralised env config + validation
├── controllers/
│   └── runsController.js    ← async run lifecycle handlers
├── middleware/
│   ├── auth.js              ← static API key enforcement
│   ├── cors.js              ← CORS + preflight
│   ├── errorHandler.js      ← central error-to-JSON converter
│   └── rateLimiter.js       ← in-memory sliding-window rate limiter
├── orchestrator/
│   ├── manager.js           ← decision policy (OPTIMIZE / REFINE / STOP)
│   ├── runExecutor.js       ← the main agent loop
│   ├── runQueue.js          ← bounded in-process job queue
│   └── runStore.js          ← in-memory run record store with TTL cleanup
├── schemas/
│   ├── api-request.json     ← POST /runs request schema
│   ├── plan.json            ← plannerAgent output schema
│   ├── schedule.json        ← optimizer/refiner output schema
│   └── review.json          ← criticAgent output schema
├── utils/
│   ├── errors.js            ← typed error classes (ApiError, LLMError, …)
│   ├── llm.js               ← OpenAI client with timeout/retry/backoff
│   ├── memory.js
│   ├── schemaValidator.js   ← Ajv-based validators for all agent outputs
│   └── validator.js         ← hard constraint checker
├── api.js
├── index.js
├── package.json
├── .env.example
└── README.md
```

## Requirements

- Node.js 18+
- OpenAI API key

## Setup

Install dependencies:

```bash
npm install
```

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

At minimum set:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

See `.env.example` for all available configuration options.

## Run (CLI)

```bash
npm start -- --goal "Prepare for a coding interview" --days 14 --hours 3
```

Or direct Node:

```bash
node index.js --goal "Prepare for a coding interview" --days 14 --hours 3
node index.js "Prepare for a coding interview in 14 days with 3 hours daily"
```

CLI options:

- `--goal`, `-g`: goal text
- `--days`, `-d`: duration override
- `--hours`, `-h`: daily-hours override

## Run (API)

Start the API server:

```bash
npm run api
```

Runs on `http://localhost:3000` by default (configure with `PORT` env var).

## API Security

Set `API_KEY` in `.env` to enable API key enforcement:

```env
API_KEY=your-secret-key
```

Clients must then send:

```
Authorization: Bearer your-secret-key
```

Leave `API_KEY` empty to disable auth (development only).

## Endpoints

### `GET /health`

```json
{ "status": "ok" }
```

---

### `POST /runs` — start async run

Request:

```json
{
  "goal": "Prepare for a coding interview",
  "days": 14,
  "hours": 3
}
```

Response `202`:

```json
{
  "success":     true,
  "run_id":      "3f7c1a2b-...",
  "status":      "queued",
  "created_at":  "2026-03-29T10:00:00.000Z",
  "polling_url": "/runs/3f7c1a2b-..."
}
```

Validation errors return `400`. Queue full returns `503`.

---

### `GET /runs/:run_id` — poll status

```json
{
  "success":      true,
  "run_id":       "3f7c1a2b-...",
  "status":       "completed",
  "progress":     { "iteration": 4, "maxIterations": 7 },
  "result": {
    "bestScore":       8.5,
    "validatorErrors": 0,
    "qualityIssues":   1,
    "suggestions":     ["..."],
    "schedule":        { "goal": "...", "schedule": { "day_1": [...] } }
  },
  "error":        null,
  "created_at":   "...",
  "started_at":   "...",
  "completed_at": "..."
}
```

`status` values: `queued` → `running` → `completed` | `failed` | `cancelled`

---

### `POST /runs/:run_id/cancel`

```json
{ "success": true, "run_id": "...", "status": "cancelled" }
```

---

### `POST /plan` *(deprecated)*

Synchronous endpoint kept for backward compatibility. Use `POST /runs` for production use cases. Responses include `Deprecation: true` header.

## LLM Configuration

`utils/llm.js` uses:

- model: `gpt-4.1`
- temperature: `0.3`
- per-call timeout: `LLM_TIMEOUT_MS` (default: 45 s)
- max retries: `LLM_MAX_RETRIES` (default: 3) with exponential backoff

All agents validate their JSON output against strict schemas. `callLLMJSON` retries once with a correction prompt on parse failure, then throws `LLMParseError`.

## Notes

- Run state in `orchestrator/runStore.js` is in-process only and lost on restart (P1: add PostgreSQL).
- Job concurrency is controlled by `QUEUE_CONCURRENCY` (default: 3); active queue capacity by `QUEUE_MAX_SIZE` (default: 50).
- Completed run records are purged after `RUN_TTL_MS` (default: 2 h) to prevent memory growth.
- The project uses ES modules (`"type": "module"`).
