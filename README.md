# 🥬 Open Coleslaw

**Just type your prompt. Like coleslaw — it's already prepared, just scoop and eat.**

Open Coleslaw is a multi-agent orchestrator plugin for Claude Code. It gives you an entire AI engineering team — architects, engineers, QA leads, product managers — that organizes itself, holds meetings, writes PRD-format minutes, and executes tasks. All you do is describe what you want.

Zero commands to memorize. Zero tools to call manually. Your AI team is already hired.

## How It Works

You type a prompt like *"Design an authentication system for our API"*. That's it. Here's what happens behind the scenes:

1. **The Orchestrator** (your proxy) analyzes your request and decides which department leaders are needed
2. **Leaders convene a meeting** — Architecture, Engineering, QA discuss in structured rounds
3. **PRD meeting minutes** are automatically generated with decisions, action items, and technical specs
4. **Tasks are compacted** from minutes and assigned to departments
5. **Workers are hired** by each leader to execute tasks in parallel
6. **Results are reported** back through the hierarchy

You get the final output. If agents need your input on an important decision, they'll `@mention` you.

## Installation

```bash
# Add the marketplace
/plugin marketplace add sshworld/open-coleslaw

# Install the plugin
/plugin install open-coleslaw@sshworld
```

### Verify Installation

Start a new Claude Code session and just type naturally:

```
Design a REST API for a todo app with user authentication
```

If Open Coleslaw is working, the orchestrator will automatically convene a meeting with the right leaders and start the discussion.

## What You Get

### 14 MCP Tools (all automatic — you never call these directly)

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
| `get-mentions` | Lists pending `@mention` decision points |
| `cancel-meeting` | Stops a meeting and cascades to all workers |
| `list-meetings` | Shows meeting history |
| `create-capability` | Self-extends the plugin with new hooks/skills |
| `get-cost-summary` | Tracks spending per agent, meeting, department |
| `chain-meeting` | Links meetings — output of one feeds into the next |

### 6 Skills (AI decides when to use them)

| Skill | Triggers When |
|-------|--------------|
| `meeting` | You ask to design, plan, discuss, or review something |
| `status` | You ask about ongoing work or what agents are doing |
| `dashboard` | You want to see the real-time visualization |
| `mention` | There are pending decisions that need your input |
| `agents` | You ask about the team hierarchy or who's working on what |
| `minutes` | You want to read past meeting minutes or search decisions |

### Real-Time Dashboard

A cyberpunk-themed "Neon Ops Center" runs at `http://localhost:35143`:

- Live agent hierarchy with animated connections
- Meeting progress tracking
- Task delegation and completion flow
- `@mention` alerts
- Cost tracking

### Self-Extending

If you ask for a workflow that doesn't exist yet, the orchestrator creates it — new hooks, skills, or automations — and registers them for future use.

## The Agent Hierarchy

```
        ┌─────────────────┐
        │   Orchestrator   │  ← Your proxy (NOT a CEO)
        │  "What do you    │    Decides, but asks you
        │   need built?"   │    for important calls
        └────────┬────────┘
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

- **The Orchestrator is your proxy, not a CEO.** You are the decision-maker. The orchestrator acts on your behalf but escalates important choices via `@mention`.
- **MVP cycles.** Work happens in loops: meeting → develop → verify → (re-meet if needed).
- **Rules survive context compaction.** Core rules are injected every session via hooks, embedded in agent prompts, and stored in persistent files. The system never forgets how to behave.
- **Agents check before they code.** Every agent analyzes the project's dependencies, existing code, and conventions before writing anything. No duplicate packages, no style violations.

## Development

```bash
git clone https://github.com/sshworld/open-coleslaw.git
cd open-coleslaw
npm install
npm run build

# Run with mock agents (no Claude CLI needed)
COLESLAW_MOCK=1 node dist/index.js

# Run tests
npm test

# Type check
npm run lint
```

## Contributing

See [CLAUDE.md](CLAUDE.md) for contributor guidelines.

## License

MIT
