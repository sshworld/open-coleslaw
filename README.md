# 🥬 Open Coleslaw

**Just type your prompt. Like coleslaw — it's already prepared, just scoop and eat.**

Open Coleslaw is a multi-agent orchestrator plugin for Claude Code. It gives you an entire AI engineering team — planner, architect, engineer, verifier, product manager, researcher — that organizes itself, runs real round-robin meetings, only ends a meeting when everyone actually agrees, and executes in MVP-sized cycles.

Zero commands to memorize. Zero tools to call manually. Your AI team is already hired.

## How It Works

You type a prompt like *"Build me a balance game app"*. That's it.

```
You: "Build me a balance game app"

  → Orchestrator dispatched (Agent tool)
  → Kickoff meeting: planner breaks it into ordered MVPs
  → For each MVP:
      → Design meeting: round-robin, consensus-based termination
      → PRD meeting minutes saved to docs/open-coleslaw/
      → Plan Mode activated — you review the implementation plan
      → You approve
      → Workers write the code in parallel
      → Verifier runs tests/build
      → Pass → next MVP ·  Fail → verify-retry meeting
  → All MVPs done → final report
```

You never call a tool. You never pick a department. You never manage an agent. The orchestrator handles everything — including entering **Plan Mode** so you can review the implementation plan in the native UI before any code is written.

Meeting minutes are saved to `docs/open-coleslaw/` in your project, so they persist even if you `/compact` or `/clear` your Claude Code context between MVPs.

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

You should see the orchestrator agent being dispatched and a kickoff meeting starting automatically.

## The Pipeline

Every request follows this flow.

```
Prompt
  → Orchestrator
  → Kickoff meeting (planner breaks request into MVPs)
  → for each MVP:
       Design meeting → consensus → Minutes → Plan Mode → Approve → Workers → Verify
  → Final report
```

Verification failure on an MVP doesn't abort the cycle — it opens a focused `verify-retry` meeting and re-plans the fix.

When the whole cycle ends the orchestrator touches a marker file, and the `Stop` hook checks your context usage. If you're over ~30%, it suggests running `/compact` or `/clear` before the next task. Minutes on disk mean you lose nothing.

## The Agent Cast

```
         ┌─────────────────┐
         │   Orchestrator   │  ← Your proxy
         │  (claude-opus)   │
         └────────┬────────┘
                  │
          (Kickoff → per-MVP loop)
                  │
    ┌─────────────┼─────────────────────────────┐
    ▼             ▼             ▼               ▼
┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Planner │ │ Architect│ │ Engineer │ │ Verifier │   dynamically convened +
│(chair)  │ │          │ │          │ │          │   product-manager / researcher
└─────────┘ └──────────┘ └──────────┘ └──────────┘
                  │
           Plan Mode → User approves
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌────────┐  ┌────────┐  ┌────────┐
│Worker 1│  │Worker 2│  │Worker N│     ← Parallel implementation
└────────┘  └────────┘  └────────┘
                  │
            Verifier runs tests
            /                \
         Pass               Fail → verify-retry meeting
          ↓
     Next MVP (or done)
```

**7 Specialists**: Planner, Architect, Engineer, Verifier, Product Manager, Researcher, plus Worker (parallelized).

The **planner always attends** — they chair the meeting, run the round-robin, and drive consensus. Other specialists are convened dynamically based on the task.

## Meetings That Actually End on Agreement

Rounds are not fixed. After every round the planner asks each participant AGREE or DISAGREE. The meeting only proceeds to synthesis when everyone agrees. If round 10 passes without consensus, the planner escalates via `@mention` for you to decide.

This is deliberately slower than a fixed-round meeting — but each MVP ends with a real decision, not a paper one.

## What's Inside

### 15 MCP Tools (orchestrator calls these — you never do)

| Tool | What It Does |
|------|-------------|
| `start-meeting` | Creates a meeting record (kickoff / design / verify-retry) |
| `add-transcript` | Saves a speaker's turn |
| `generate-minutes` | Writes PRD minutes from transcripts |
| `get-meeting-status` | Reads meeting progress |
| `get-minutes` | Retrieves full / summary / tasks-only minutes |
| `execute-tasks` | Returns the structured task list from minutes for worker dispatch |
| `get-task-report` | Shows execution results per department |
| `get-agent-tree` | Displays the agent hierarchy (bookkeeping) |
| `respond-to-mention` | Resolves a pending decision escalated by an agent |
| `get-mentions` | Lists pending @mention decisions |
| `cancel-meeting` | Stops a meeting and cascades to workers |
| `list-meetings` | Shows meeting history |
| `create-capability` | Self-extends the plugin with new hooks/skills |
| `get-cost-summary` | Tracks spend per agent/meeting/department |
| `chain-meeting` | Links meetings — previous minutes feed the next |

### 8 Agents (dispatched via the Agent tool)

| Agent | Role |
|-------|------|
| `orchestrator` | Your proxy — manages the kickoff + per-MVP cycles |
| `planner` | Runs the meeting, chairs rounds, checks consensus, synthesises minutes |
| `architect` | System design, API contracts, schemas |
| `engineer` | Implementation feasibility, code quality |
| `verifier` | Testing strategy at design time; tests/build at verify time |
| `product-manager` | Requirements, user stories, prioritisation |
| `researcher` | Codebase exploration, prior art, library comparison |
| `worker` | Writes code (N workers in parallel) |

### 7 Skills

| Skill | Purpose |
|-------|---------|
| `using-open-coleslaw` | Injected at session start — ensures all requests go through the pipeline |
| `meeting` | Dispatches the orchestrator for the meeting → plan → implement flow |
| `status` | Shows active meetings, agents, pending mentions |
| `dashboard` | Opens the real-time dashboard |
| `mention` | Handles pending @mention decisions |
| `agents` | Shows the agent hierarchy tree |
| `minutes` | Browses past meeting minutes |

### Real-Time Meeting Dashboard

A live meeting viewer at `http://localhost:35143`:

- **Current meeting as a thread** — speakers post comments, consensus stances are shown inline
- **MVP progress panel** — which MVPs are pending / in-progress / done
- **User comment box** — type a note straight into the meeting from the browser; the orchestrator picks it up at the next round boundary (file-queue routed to `docs/open-coleslaw/.pending-comments.jsonl`)
- **Terminal comments also work** — if you prompt Claude Code while a meeting is in progress, your prompt becomes a user turn in the thread
- Per-project tabs (multiple terminals → multiple tabs); duplicate names auto-number: `project`, `project (1)`

### Self-Extending

Ask for a workflow that doesn't exist yet, and the orchestrator creates it — new hooks, skills, or automations — registered for future use.

## Agent Tiers

| Tier | Model | Role |
|------|-------|------|
| Orchestrator | claude-opus (1M context) | Full-picture routing, delegation, judgment |
| Leader (specialists) | claude-sonnet | Meetings, technical decisions |
| Worker | claude-sonnet | Code, implementation |
| Research Worker | claude-haiku | Quick lookups, exploration |

## Philosophy

### The Coleslaw Principle

Coleslaw is a side dish that's already made. You don't prepare it — you just eat it. This plugin works the same way. You don't configure agents, define workflows, or call tools. You describe what you want, and the system figures out the rest.

### Key Decisions

- **The Orchestrator is your proxy, not a CEO.** You are the decision-maker. The orchestrator acts on your behalf but escalates important choices via @mention.
- **Kickoff first.** Every non-trivial request starts by breaking itself into ordered MVPs.
- **Consensus, not round count.** A meeting ends when everyone actually agrees (or you are asked to break a tie).
- **Minutes are the real artifact.** They survive `/compact` and `/clear` — your Claude Code context is disposable.
- **Agents check before they code.** Every specialist reads the project's state before proposing anything.

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
