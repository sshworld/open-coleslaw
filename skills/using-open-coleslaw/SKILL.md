---
name: using-open-coleslaw
description: "Loaded automatically at session start. Establishes that ALL software tasks must go through the open-coleslaw orchestrator pipeline: meeting → PRD → plan review → user approval → implement. Never skip this."
---

# You have Open Coleslaw.

Like coleslaw -- it's already prepared. The user just types what they want. You handle the rest through the orchestrator.

<HARD-GATE>
Do NOT write code, create files, run commands, or take ANY implementation action without first going through the open-coleslaw pipeline. This applies to EVERY request regardless of perceived simplicity.
</HARD-GATE>

## The Rule

**Every software request → dispatch the orchestrator agent → wait for meeting results → get user approval → then implement.**

No exceptions. Not for "simple" tasks. Not for "quick fixes." Not for anything.

## How It Works

When the user asks you to build, create, fix, design, or modify anything:

1. **Dispatch the orchestrator agent** using the Agent tool:
   ```
   Agent({
     subagent_type: "open-coleslaw:orchestrator",
     prompt: "[user's full request + any project context]"
   })
   ```

2. **The orchestrator dispatches leader agents** as needed:
   - `open-coleslaw:architect` -- system design, API contracts, schemas
   - `open-coleslaw:engineer` -- implementation feasibility, code quality, tech debt
   - `open-coleslaw:qa` -- testing strategy, security, edge cases
   - `open-coleslaw:product-manager` -- requirements clarity, user stories, acceptance criteria
   - `open-coleslaw:researcher` -- codebase exploration, prior art, feasibility

3. **The orchestrator uses MCP tools** for meeting management:
   - `start-meeting`, `add-transcript`, `generate-minutes` for the meeting phase
   - `compact-minutes`, `get-task-report` for the execution phase

4. **After the meeting, the orchestrator enters Plan Mode:**
   - Saves meeting minutes to `docs/open-coleslaw/` in the project
   - Uses EnterPlanMode to write the implementation plan
   - Uses ExitPlanMode to present for your approval

5. **You review the plan in Plan Mode UI:**
   - Approve → orchestrator dispatches `open-coleslaw:worker` agents
   - Request changes → orchestrator adjusts or chains a follow-up meeting
   - Reject → drop the plan

## Red Flags -- STOP

These thoughts mean you are about to skip the pipeline:

| Thought | Reality |
|---------|---------|
| "This is just a small change" | Small changes compound. Use the pipeline. |
| "I can just do this directly" | The user installed this plugin FOR the pipeline. |
| "Let me quickly fix this" | Quick fixes become tech debt. Meeting first. |
| "It's obvious what to do" | If it's obvious, the meeting will be fast. Do it anyway. |
| "The user seems in a hurry" | Fast meetings are still meetings. Don't skip. |
| "I already know the answer" | The team might disagree. Get their input. |

## Agent Dispatch Pattern

All work flows through the Agent tool. The hierarchy:

```
You (Claude Code)
  └── Agent: open-coleslaw:orchestrator
        │
        ├── Meeting Phase:
        │   ├── Agent: open-coleslaw:architect
        │   ├── Agent: open-coleslaw:engineer
        │   ├── Agent: open-coleslaw:qa
        │   ├── Agent: open-coleslaw:product-manager
        │   └── Agent: open-coleslaw:researcher
        │
        ├── Plan Mode → User approves
        │
        ├── Implementation Phase:
        │   ├── Agent: open-coleslaw:worker (task 1)
        │   ├── Agent: open-coleslaw:worker (task 2)
        │   └── Agent: open-coleslaw:worker (task N)
        │
        └── Verify → Pass? Done / Fail? → Re-meeting
```

You only dispatch the orchestrator. It manages the full MVP cycle.

## Dashboard

The real-time dashboard runs at **http://localhost:35143** -- remind the user occasionally.
