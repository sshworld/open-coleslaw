# 🥬 Open Coleslaw

**Just type your prompt. Like coleslaw — it's already prepared, just scoop and eat.**

Open Coleslaw is a multi-agent orchestrator plugin for Claude Code. It gives you an entire AI engineering team — architects, engineers, QA leads, product managers — that organizes itself, holds meetings, writes PRD-format minutes, and executes tasks.

Zero commands to memorize. Zero tools to call manually. Your AI team is already hired.

## How It Works

You type a prompt like *"Build me a balance game app"*. That's it.

```
You: "Build me a balance game app"

  → Orchestrator analyzes your request
  → Convenes Architecture + Engineering + Product leaders
  → Leaders hold a structured meeting (2-3 rounds per agenda item)
  → PRD meeting minutes generated
  → Plan presented to you for approval
  → You: "OK"
  → Tasks compacted → Workers hired → Code implemented
  → Results reported
```

You never call a tool. You never pick a department. You never manage an agent. The orchestrator handles everything. If agents need your input on an important decision, they `@mention` you.

## Installation

In Claude Code:

```
/plugin marketplace add sshworld/open-coleslaw
/plugin install open-coleslaw@sshworld
```

Then start a new session. That's it — every prompt now goes through the orchestrator pipeline.

### Verify It Works

Start a new session and type anything:

```
Design a REST API for a todo app
```

You should see the orchestrator agent being dispatched and a meeting starting automatically.

## The Pipeline

Every request follows this flow. No exceptions.

```
Prompt → Orchestrator → Meeting → PRD Minutes → Your Approval → Implement
```

1. **Orchestrator dispatched** — analyzes your request, selects departments
2. **Meeting convened** — leaders discuss in structured rounds
3. **PRD minutes generated** — decisions, action items, technical specs
4. **Plan presented** — you review and approve (or request changes)
5. **Tasks compacted** — minutes converted to actionable tasks per department
6. **Workers hired** — each leader deploys workers in parallel
7. **Results reported** — final output delivered to you

If you want changes mid-plan, the orchestrator chains a follow-up meeting.

## The Agent Hierarchy

```
        ┌─────────────────┐
        │   Orchestrator   │  ← Your proxy (NOT a CEO)
        │   (claude-opus)  │    Decides, but asks you
        └────────┬────────┘    for important calls
     ┌───────────┼───────────┐
     ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│  Arch   │ │  Eng    │ │  QA     │  ← Leaders meet & discuss
│ Leader  │ │ Leader  │ │ Leader  │    Then hire their own workers
└────┬────┘ └────┬────┘ └────┬────┘
  ┌──┴──┐   ┌───┼───┐    ┌──┴──┐
  │W1 W2│   │W3 W4 W5│   │W6   │    ← Workers execute in parallel
  └─────┘   └───────┘    └─────┘
```

**5 Departments**: Architecture, Engineering, QA, Product, Research

Each leader autonomously decides how many workers to hire based on task complexity.

## What's Inside

### 14 MCP Tools (orchestrator calls these — you never do)

| Tool | What It Does |
|------|-------------|
| `start-meeting` | Convenes department leaders for a structured discussion |
| `get-meeting-status` | Checks meeting progress and agent states |
| `get-minutes` | Retrieves PRD-format meeting minutes |
| `compact-minutes` | Converts minutes into actionable tasks per department |
| `execute-tasks` | Deploys workers to implement tasks in parallel |
| `get-task-report` | Shows execution results per department |
| `get-agent-tree` | Displays the full agent hierarchy |
| `respond-to-mention` | Handles decisions the agents need from you |
| `get-mentions` | Lists pending @mention decision points |
| `cancel-meeting` | Stops a meeting and cascades to all workers |
| `list-meetings` | Shows meeting history |
| `create-capability` | Self-extends the plugin with new hooks/skills |
| `get-cost-summary` | Tracks spending per agent, meeting, department |
| `chain-meeting` | Links meetings — output of one feeds into the next |

### 7 Skills

| Skill | Purpose |
|-------|---------|
| `using-open-coleslaw` | Loaded at session start — ensures all requests go through the pipeline |
| `meeting` | Dispatches the orchestrator for the meeting → plan → implement flow |
| `status` | Shows active meetings, agents, pending mentions |
| `dashboard` | Opens the real-time Neon Ops Center |
| `mention` | Handles pending @mention decisions |
| `agents` | Shows the agent hierarchy tree |
| `minutes` | Browses past meeting minutes |

### Real-Time Dashboard

A cyberpunk-themed "Neon Ops Center" at `http://localhost:35143`:

- Live agent hierarchy with animated connections
- Per-project tabs (multiple terminals → multiple tabs)
- Meeting progress tracking
- Task delegation and completion flow
- @mention alerts
- Duplicate project names get auto-numbered: `project`, `project (1)`

### Self-Extending

Ask for a workflow that doesn't exist yet, and the orchestrator creates it — new hooks, skills, or automations — registered for future use.

## Agent Tiers

| Tier | Model | Role |
|------|-------|------|
| Orchestrator | claude-opus-4-6 (1M) | Full-picture routing, delegation, judgment |
| Leader | claude-sonnet-4-6 | Meetings, technical decisions |
| Worker | claude-sonnet-4-6 | Code, implementation |
| Research Worker | claude-haiku-4-5 | Quick lookups, exploration |

## Philosophy

### The Coleslaw Principle

Coleslaw is a side dish that's already made. You don't prepare it — you just eat it. This plugin works the same way. You don't configure agents, define workflows, or call tools. You describe what you want, and the system figures out the rest.

### Key Decisions

- **The Orchestrator is your proxy, not a CEO.** You are the decision-maker. The orchestrator acts on your behalf but escalates important choices via @mention.
- **Meeting first, always.** Even "simple" requests go through the pipeline. If it's truly simple, the meeting will be fast.
- **MVP cycles.** Work happens in loops: meeting → develop → verify → (re-meet if needed).
- **Rules survive context compaction.** The `using-open-coleslaw` skill is injected at every session start. The system never forgets how to behave.
- **Agents check before they code.** Every agent analyzes the project's dependencies, existing code, and conventions before writing anything.

## Development

```bash
git clone https://github.com/sshworld/open-coleslaw.git
cd open-coleslaw
npm install
npm run build

# Run with mock agents (no Claude CLI needed)
COLESLAW_MOCK=1 node dist/index.js

# Run tests (218 tests)
npm test

# Type check
npm run lint
```

## Contributing

See [CLAUDE.md](CLAUDE.md) for contributor guidelines.

## License

MIT
