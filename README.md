# Multi-Agent Planner

This project is a small Node.js prototype that uses multiple LLM-driven agents to turn a natural language goal into a structured plan, generate a day-by-day schedule, critique the schedule, and refine it across a few iterations.

## What It Does

- Accepts a user goal such as preparing for a coding interview in 14 days
- Breaks the goal into structured tasks
- Converts those tasks into a daily schedule
- Reviews the schedule for quality and constraint issues
- Refines the schedule based on critic feedback

## Agent Flow

The current workflow is orchestrated from `index.js`.

1. `plannerAgent` converts a goal into structured tasks
2. `optimizerAgent` turns tasks into a schedule
3. `criticAgent` scores the schedule and identifies issues
4. `refinerAgent` updates the schedule using critic feedback
5. The loop runs up to 3 refinement attempts and keeps improved results

## Project Structure

```text
.
├── agents/
│   ├── plannerAgent.js
│   ├── optimizerAgent.js
│   ├── criticAgent.js
│   └── refinerAgent.js
├── orchestrator/
├── utils/
│   ├── llm.js
│   └── memory.js
├── index.js
└── package.json
```

## Requirements

- Node.js 18+
- An OpenAI API key

## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_api_key_here
```

## Run

```bash
node index.js
```

## How The LLM Is Used

The OpenAI client is configured in `utils/llm.js` and currently uses:

- model: `gpt-4.1`
- temperature: `0.3`

Each agent sends a specialized prompt and expects strict JSON back from the model.

## Notes

- Memory is currently in-process only and resets on each run
- The `orchestrator/` folder exists but is not used yet
- The project uses ES modules through `"type": "module"` in `package.json`

## Example Goal

The current entrypoint uses this example goal:

```text
I want to prepare for a coding interview in 14 days with 3 hours daily
```

You can change that string in `index.js` to generate plans for other goals.