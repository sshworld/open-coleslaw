# Open Coleslaw

Multi-agent orchestrator plugin for Claude Code.

## Architecture
- Flat dispatch: main Claude session (meeting runner) -> specialist subagents (per speaker turn) -> worker subagents (per implementation task). No nested orchestrator subagent; the main session IS the orchestrator.
- MCP Server over stdio transport + Claude Code plugin (skills, hooks, agents)
- SQLite storage at ~/.open-coleslaw/data.db
- Web dashboard at http://localhost:35143
- Claude CLI subprocess for agent execution (mock mode with COLESLAW_MOCK=1)

## Tech Stack
- TypeScript (strict, ESM)
- @modelcontextprotocol/sdk -- MCP server
- better-sqlite3 -- storage
- ws -- WebSocket for dashboard
- zod -- validation
- tsup -- build
- vitest -- testing

## Build & Run
- `npm run build` -- build with tsup
- `npm run dev` -- watch mode
- `npm test` -- vitest (219 tests)
- `npm run lint` -- tsc --noEmit
- `npm run clean` -- remove dist/

## Project Structure (~80 source files)
```
src/
  index.ts              -- entry point, stdio transport + dashboard startup
  server.ts             -- MCP server creation, 14 tool registrations
  tools/                -- MCP tool handlers (14 tools, 15 files + index)
  orchestrator/         -- orchestrator logic, meeting runner, leader pool, worker manager
  meeting/              -- meeting protocol, minutes generation, compaction, mention detection
  agents/               -- agent factory, prompts, project analyzer, claude CLI invoker
  dashboard/            -- web dashboard server (inline HTML + Cytoscape.js)
  extension/            -- self-extending capability system
  storage/              -- SQLite schema, CRUD for agents/meetings/mentions/tasks/events
  hooks/                -- hook scripts (pre-read, auto-route, auto-commit, doc-update, flow-verify, mvp-cycle)
  skills/               -- skill prompt generators
  assets/               -- rules.md, plugin-guide.md, templates, configs
  installer/            -- install/uninstall helpers
  types/                -- TypeScript type definitions
  utils/                -- logger, config, cost tracker
```

## MCP Tools (15 registered)
1. `start-meeting` -- Convene a meeting (`kickoff` | `design` | `verify-retry`) with a topic + agenda
2. `get-meeting-status` -- Get meeting progress and agent states
3. `get-minutes` -- Retrieve PRD-format meeting minutes
4. `execute-tasks` -- Return the task list directly from `minutes.actionItems` for worker dispatch
5. `get-agent-tree` -- Display the full agent hierarchy tree (bookkeeping)
6. `respond-to-mention` -- Respond to a pending @mention decision
7. `get-mentions` -- List @mentions filtered by status/meeting
8. `cancel-meeting` -- Cancel a meeting with cascade to all workers
9. `list-meetings` -- List meetings with status filter and pagination
10. `get-task-report` -- Execution report with per-department breakdown
11. `create-capability` -- Self-extend: create new hook/skill/command/asset/loop
12. `get-cost-summary` -- Cost tracking per agent/meeting/department
13. `chain-meeting` -- Link meetings: output of one feeds into the next
14. `add-transcript` -- Record a speaker's turn during a meeting
15. `generate-minutes` -- Write PRD minutes from the accumulated transcripts

## Agent Tiers
| Tier | Model | Role |
|------|-------|------|
| Meeting runner (main session) | whatever user picked in Claude Code | Dispatches specialists, runs MCP tools, calls EnterPlanMode, dispatches workers, verifies |
| Specialist subagent | inherits from session | One per speaker turn: planner / architect / engineer / verifier / product-manager / researcher |
| Worker subagent | inherits from session | One per parallel implementation task |

**No model hard-coding anywhere.** All `agents/*.md` files use `model: inherit`.
`TIER_CONFIGS` in `src/types/agent.ts` has `maxTurns` only — no `model` field.
Switching `/model` in the user's Claude Code session changes the whole pipeline.

Specialist roles: `planner`, `architect`, `engineer`, `verifier`, `product-manager`, `researcher`, plus `worker` for implementation.

## Departments & Allowed Tools
- **Planning**: Read (planner always attends; facilitates, doesn't take positions)
- **Architecture**: Read, Grep, Glob
- **Engineering**: Read, Grep, Glob, Write, Edit, Bash
- **Verification**: Read, Grep, Glob, Bash (formerly QA; now also runs verification after implementation)
- **Product**: Read
- **Research**: Read, Grep, Glob, WebSearch

## Conventions
- ESM imports with .js extensions
- All timestamps: Date.now() (Unix ms)
- JSON fields in SQLite: serialize/deserialize in store functions
- Conventional commits: feat/fix/docs/refactor/test/chore
- Agent system prompts include core rules from rules.md
- Mock mode: set COLESLAW_MOCK=1 for development without Claude CLI
- Node.js >= 18 required

## Key Decisions
- **Flat dispatch (v0.6.0+)** — main Claude session runs the whole pipeline
  directly. No `orchestrator` subagent. Every speaker turn is a real
  `Agent({ subagent_type: "open-coleslaw:<role>" })` call followed by
  `add-transcript` with the real response. Previously we had an orchestrator
  subagent that role-played every specialist, which defeated the multi-agent
  premise — fixed.
- **Skill as runbook** — `skills/using-open-coleslaw/SKILL.md` is the full
  pipeline instruction set that the main session follows. Loaded at session
  start via the `session-start` hook.
- **Model inheritance everywhere** — no hard-coded model names. Agent .md
  files use `model: inherit`; `TIER_CONFIGS` has no `model` field.
- **Agents respond in the user's language** — detect from the original
  request and propagate through orchestrator → specialists. Minutes in the
  same language.
- Kickoff meeting breaks user request into ordered MVPs before any design meeting
- Meetings terminate on **consensus**, not round count (MAX_ROUNDS=10 escalates to @mention)
- Planner always attends; facilitates and synthesizes, doesn't take technical positions
- Dynamic attendee selection — not every specialist attends every meeting
- Specialists and workers are always dispatched by the **main session**,
  destroyed after task completion.
- Minutes saved to project's `docs/open-coleslaw/` with INDEX.md (per-project, survives compact/clear)
- Dashboard renders a **meeting thread + comments UI**; browser comments flow through a file queue
- Stop hook checks context usage at cycle end (`.cycle-complete` marker) and suggests `/compact` or `/clear` above ~30%
- Self-extending: creates new capabilities on demand
- Rule priority: rules.md > CLAUDE.md > conversation context
- MVP cycle: kickoff -> (per MVP: design -> plan -> workers -> verify -> fail? verify-retry). The main session runs every step.
