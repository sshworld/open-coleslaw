# Open Coleslaw

Multi-agent orchestrator plugin for Claude Code.

## Architecture
- 3-tier hierarchy: Orchestrator (proxy) -> Leaders (team leads) -> Workers (executors)
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

## MCP Tools (14 registered)
1. `start-meeting` -- Convene department leaders for a structured discussion
2. `get-meeting-status` -- Get meeting progress and agent states
3. `get-minutes` -- Retrieve PRD-format meeting minutes
4. `compact-minutes` -- Convert minutes into department-assigned task list
5. `execute-tasks` -- Deploy workers to implement tasks in parallel
6. `get-agent-tree` -- Display the full agent hierarchy tree
7. `respond-to-mention` -- Respond to a pending @mention decision
8. `get-mentions` -- List @mentions filtered by status/meeting
9. `cancel-meeting` -- Cancel a meeting with cascade to all workers
10. `list-meetings` -- List meetings with status filter and pagination
11. `get-task-report` -- Execution report with per-department breakdown
12. `create-capability` -- Self-extend: create new hook/skill/command/asset/loop
13. `get-cost-summary` -- Cost tracking per agent/meeting/department
14. `chain-meeting` -- Link meetings: output of one feeds into the next

## Agent Tiers
| Tier | Model | Role |
|------|-------|------|
| Orchestrator | claude-opus-4-6 (1M) | Full-picture routing, delegation |
| Leader | claude-sonnet-4-6 | Meetings, technical decisions |
| Worker (impl) | claude-sonnet-4-6 | Code, implementation |
| Worker (research) | claude-haiku-4-5 | Quick lookups |

## Departments & Allowed Tools
- **Architecture**: Read, Grep, Glob
- **Engineering**: Read, Grep, Glob, Write, Edit, Bash
- **QA**: Read, Grep, Glob, Bash
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
- Orchestrator is user's proxy/delegate, NOT CEO
- Leaders communicate via relay-mediated meetings (MeetingRunner)
- Workers spawned on-demand by leaders, destroyed after task completion
- Minutes saved to both SQLite and ~/.open-coleslaw/minutes/ with INDEX.md
- Dashboard uses inline HTML + Cytoscape.js from CDN (no React build step)
- Self-extending: creates new capabilities on demand
- Rule priority: rules.md > CLAUDE.md > conversation context
- MVP cycle: meeting -> develop -> verify -> (fail? -> re-meeting)
