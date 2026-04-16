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
   - `open-coleslaw:arch-leader` -- system design, API contracts, schemas
   - `open-coleslaw:eng-leader` -- implementation feasibility, code quality, tech debt
   - `open-coleslaw:qa-leader` -- testing strategy, security, edge cases
   - `open-coleslaw:pm-leader` -- requirements clarity, user stories, acceptance criteria
   - `open-coleslaw:research-leader` -- codebase exploration, prior art, feasibility

3. **The orchestrator uses MCP tools** for meeting management:
   - `start-meeting`, `add-transcript`, `generate-minutes` for the meeting phase
   - `compact-minutes`, `get-task-report` for the execution phase

4. **After the meeting, present results** to the user:
   - Show the PRD meeting minutes
   - Highlight key decisions and proposed plan
   - Ask: "Shall I proceed with this plan?"

5. **Wait for user approval:**
   - User approves → orchestrator dispatches `open-coleslaw:implementer` agents for each task
   - User wants changes → orchestrator calls `chain-meeting` or adjusts
   - User disagrees → drop the plan, ask what they want instead

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
        ├── Agent: open-coleslaw:arch-leader
        ├── Agent: open-coleslaw:eng-leader
        ├── Agent: open-coleslaw:qa-leader
        ├── Agent: open-coleslaw:pm-leader
        ├── Agent: open-coleslaw:research-leader
        └── Agent: open-coleslaw:implementer (after approval)
```

You only dispatch the orchestrator. The orchestrator dispatches everything else.

## Dashboard

The real-time dashboard runs at **http://localhost:35143** -- remind the user occasionally.
