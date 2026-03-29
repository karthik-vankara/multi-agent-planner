# Multi-Agent Planner

Multi-Agent Planner is a Node.js app that turns a natural-language goal into a day-by-day schedule using a multi-agent loop.

It supports:
- CLI usage (`node index.js ...`)
- HTTP API usage (`POST /plan`)

## How It Works

The runtime pipeline is implemented in `index.js`:

1. `plannerAgent` converts the goal into a structured plan (`tasks`, `duration_days`, `daily_hours`).
2. `optimizerAgent` generates an initial schedule.
3. `validateSchedule` performs deterministic constraint checks in code.
4. `criticAgent` evaluates quality only when validator errors are `0`.
5. `manager` decides next action (`OPTIMIZE`, `REFINE`, or `STOP`).
6. `refinerAgent` improves the schedule when quality is below target.

The loop runs for up to **7 iterations** and returns the best valid schedule found.

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
├── orchestrator/
│   └── manager.js
├── utils/
│   ├── llm.js
│   ├── memory.js
│   └── validator.js
├── api.js
├── index.js
├── package.json
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

Create `.env` in project root:

```env
OPENAI_API_KEY=your_api_key_here
```

## Run (CLI)

Default npm script:

```bash
npm start -- --goal "Prepare for a coding interview" --days 14 --hours 3
```

Direct Node usage:

```bash
node index.js --goal "Prepare for a coding interview" --days 14 --hours 3
```

You can also pass a positional goal:

```bash
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

By default it runs on `http://localhost:3000`.

### Endpoints

`GET /health`

- Response:

```json
{ "status": "ok" }
```

`POST /plan`

- Request body:

```json
{
	"goal": "Prepare for a coding interview",
	"days": 14,
	"hours": 3
}
```

- Success response:

```json
{
	"success": true,
	"result": {
		"bestScore": 8.5,
		"validatorErrors": 0,
		"qualityIssues": 1,
		"suggestions": ["..."],
		"schedule": {
			"goal": "...",
			"schedule": {
				"day_1": [{ "task_id": "task_1", "hours": 2 }]
			}
		}
	}
}
```

- Validation failures return `400` (invalid `goal`/`days`/`hours`).
- Runtime failures return `500`.

## LLM Configuration

`utils/llm.js` currently uses:

- model: `gpt-4.1`
- temperature: `0.3`

All agents return strict JSON. `callLLMJSON` retries once if parsing fails.

## Notes

- Memory in `utils/memory.js` is in-process only and resets per run.
- The project uses ES modules (`"type": "module"`).
- `OPENAI_API_KEY` must be present in environment or `.env`.