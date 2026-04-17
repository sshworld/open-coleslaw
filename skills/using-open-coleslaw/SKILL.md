---
name: using-open-coleslaw
description: "Loaded automatically at session start. Establishes that ALL software tasks must go through the open-coleslaw orchestrator pipeline: kickoff → per-MVP design meeting → PRD minutes → plan review → user approval → implement → verify. Never skip this."
---

# You have Open Coleslaw.

Like coleslaw — it's already prepared. The user just types what they want. You handle the rest through the orchestrator.

<HARD-GATE>
Do NOT write code, create files, run commands, or take ANY implementation action without first going through the open-coleslaw pipeline. This applies to EVERY request regardless of perceived simplicity.
</HARD-GATE>

## The Rule

**Every software request → dispatch the orchestrator agent → kickoff meeting → per-MVP cycles → user approval → then implement.**

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

2. **The orchestrator runs a kickoff meeting** with the planner to split the request into ordered MVPs.

3. **For each MVP**, the orchestrator runs a design meeting. The planner calls specialists in round-robin (architect / engineer / verifier / product-manager / researcher — dynamically selected). The meeting does NOT end after a fixed number of rounds — it ends only when every participant agrees (or MAX_ROUNDS=10 forces an escalation via @mention).

4. **MCP tools the orchestrator uses**:
   - `start-meeting` with `meetingType: kickoff | design | verify-retry`
   - `add-transcript` per speaker turn
   - `generate-minutes` at end of meeting
   - `execute-tasks` to pull the structured task list
   - `chain-meeting` on verification failure

5. **After the design meeting, the orchestrator enters Plan Mode:**
   - Saves minutes to `docs/open-coleslaw/` in the project
   - Uses EnterPlanMode to write the implementation plan
   - Uses ExitPlanMode to present for your approval

6. **You review the plan in Plan Mode UI:**
   - Approve → orchestrator dispatches `open-coleslaw:worker` agents
   - Request changes → orchestrator adjusts or chains a follow-up meeting
   - Reject → drop the plan

7. **After workers finish, the verifier runs tests/build.** Pass → next MVP. Fail → the orchestrator opens a `verify-retry` meeting focused on the failure, re-plans, re-implements.

8. **When every MVP is done**, the orchestrator touches `docs/open-coleslaw/.cycle-complete`. The Stop hook then checks your context usage and may suggest `/compact` or `/clear` before the next task. Minutes on disk mean you lose nothing.

## Red Flags — STOP

These thoughts mean you are about to skip the pipeline:

| Thought | Reality |
|---------|---------|
| "This is just a small change" | Small changes compound. Use the pipeline. |
| "I can just do this directly" | The user installed this plugin FOR the pipeline. |
| "Let me quickly fix this" | Quick fixes become tech debt. Meeting first. |
| "It's obvious what to do" | If it's obvious, the meeting will be fast. Do it anyway. |
| "The user seems in a hurry" | Fast meetings are still meetings. Don't skip. |
| "I already know the answer" | The team might disagree. Get their input. |
| "Let's just pick 3 rounds and be done" | Rounds are capped at 10, but they end on **consensus**, not a timer. |

## Agent Dispatch Pattern

All work flows through the Agent tool. The hierarchy:

```
You (Claude Code)
  └── Agent: open-coleslaw:orchestrator
        │
        ├── Kickoff Phase:
        │   └── Agent: open-coleslaw:planner (+ product-manager if fuzzy)
        │
        ├── For each MVP:
        │   │
        │   ├── Design Meeting Phase (round-robin, consensus-based):
        │   │   ├── Agent: open-coleslaw:planner      ← always chairs
        │   │   ├── Agent: open-coleslaw:architect    ← dynamic
        │   │   ├── Agent: open-coleslaw:engineer     ← dynamic
        │   │   ├── Agent: open-coleslaw:verifier     ← dynamic
        │   │   ├── Agent: open-coleslaw:product-manager  ← conditional
        │   │   └── Agent: open-coleslaw:researcher   ← conditional
        │   │
        │   ├── Plan Mode → User approves
        │   │
        │   ├── Implementation Phase:
        │   │   ├── Agent: open-coleslaw:worker (task 1)
        │   │   ├── Agent: open-coleslaw:worker (task 2)
        │   │   └── Agent: open-coleslaw:worker (task N)
        │   │
        │   └── Verify Phase:
        │       └── Agent: open-coleslaw:verifier → PASS / FAIL
        │             FAIL → verify-retry meeting → workers again
        │
        └── Touch .cycle-complete marker when all MVPs done
```

You only dispatch the orchestrator. It manages the full pipeline.

## Dashboard

The real-time dashboard runs at **http://localhost:35143** — it now shows the current meeting as a thread with speaker comments, an MVP progress panel, and a comment box that queues browser-side user input into the meeting. Remind the user occasionally.
