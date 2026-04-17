---
name: using-open-coleslaw
description: "Loaded automatically at session start. Establishes the 2-phase open-coleslaw pipeline: Phase A dispatches the orchestrator subagent to run meetings (kickoff + per-MVP design). Phase B is run by the main Claude session — reads the orchestrator's structured result, enters Plan Mode, gets user approval, dispatches workers, verifies."
---

# You have Open Coleslaw.

Like coleslaw — it's already prepared. The user just types what they want. You handle the rest through a **2-phase pipeline** below.

<HARD-GATE>
Do NOT write code, create files, run commands, or take ANY implementation action without first going through the pipeline. This applies to EVERY request regardless of perceived simplicity.

Language: **respond and run meetings in the same language the user used** (ask in Korean → minutes in Korean).
</HARD-GATE>

## Why 2 Phases?

`EnterPlanMode` / `ExitPlanMode` do NOT work from inside a dispatched subagent — only the **main** Claude session can enter Plan Mode. So we split:

- **Phase A (subagent)**: orchestrator runs the meetings. Produces minutes on disk + a structured result.
- **Phase B (main session, YOU)**: receive the structured result, call `EnterPlanMode`, get user approval, dispatch workers, verify.

## Phase A — Dispatch the Orchestrator

1. Dispatch `open-coleslaw:orchestrator` via the Agent tool:
   ```
   Agent({
     subagent_type: "open-coleslaw:orchestrator",
     prompt: `<user's full request>

     Project context:
     - cwd: ${cwd}
     - tech stack / git state / anything obvious
     - Language: ${detected-language-of-user-request, e.g., Korean}

     Run the full meeting pipeline:
     1. Kickoff meeting → decompose into MVPs
     2. Design meeting for MVP-1 → reach consensus → minutes
     (Stop after MVP-1's design meeting. Do NOT write code. Do NOT call EnterPlanMode.)

     Return a STRUCTURED result:
     - minutesPaths: absolute paths to all minutes written under docs/open-coleslaw/
     - mvps: [{title, goal, scope}]  — ordered list from the kickoff
     - currentMvp: { title, goal }    — the MVP-1 we just designed
     - plan: {
         context: short summary of the design decisions,
         files: list of files to create/modify,
         tasks: ordered list of concrete implementation tasks for workers,
         acceptance: verification criteria from the verifier,
       }
     `
   })
   ```

2. The orchestrator runs meetings (round-robin, consensus-based), writes minutes to `docs/open-coleslaw/`, and returns the structured result.

## Phase B — You Continue the Pipeline

3. Parse the orchestrator's return value. Confirm minutes file exists.

4. **Enter Plan Mode** with a plan built from `plan.context`, `plan.files`, `plan.tasks`, `plan.acceptance`:
   - `EnterPlanMode`
   - Write a concise plan file (Context / Files / Tasks / Verification sections)
   - `ExitPlanMode` → user sees it and approves/rejects

5. **On rejection**: re-dispatch orchestrator with `chain-meeting` semantics (pass previous meetingId + user feedback) to re-run the MVP-1 design meeting.

6. **On approval**: dispatch `open-coleslaw:worker` agents in parallel (one per task from `plan.tasks`):
   ```
   Agent({ subagent_type: "open-coleslaw:worker", prompt: "<specific task>" })
   ```
   Wait for all to finish. Aggregate results.

7. **Verify**: dispatch `open-coleslaw:verifier`:
   ```
   Agent({ subagent_type: "open-coleslaw:verifier", prompt: `
     Acceptance criteria: ${plan.acceptance}
     Worker results: ${aggregated}
     Run tests / build. Report PASS or FAIL.
   `})
   ```

8. **PASS** → move to next MVP: dispatch orchestrator again for MVP-2's design meeting (skip kickoff; orchestrator reads existing `docs/open-coleslaw/` to know the MVP list). Repeat Phase B.

   **FAIL** → dispatch orchestrator with `meetingType: verify-retry` for a focused fix meeting. Then re-plan (Phase B step 4), re-implement.

9. **All MVPs done** → touch `docs/open-coleslaw/.cycle-complete` marker (this lets the Stop hook check context usage). Final summary to user.

## Red Flags — STOP

| Thought | Reality |
|---------|---------|
| "This is just a small change" | Small changes compound. Use the pipeline. |
| "Let me quickly fix this" | Meeting first. |
| "I know what to write" | Specialists might disagree. Meet. |
| "Skip the kickoff for one-file change" | Always run kickoff. MVP list may just be `[one item]`. |
| "Orchestrator said do X, let me just do X" | No — enter Plan Mode first, get user approval. |
| "User asked in English/Korean so write minutes in English" | **Write minutes in the user's language.** |

## Agent Dispatch Summary

```
You (main Claude session)
  │
  ├── Phase A: Agent({ subagent_type: "open-coleslaw:orchestrator", ... })
  │     └── inside subagent:
  │           ├── start-meeting (kickoff)
  │           ├── dispatch open-coleslaw:planner
  │           ├── generate-minutes → save to docs/open-coleslaw/
  │           ├── start-meeting (design for MVP-1)
  │           ├── round-robin dispatch: architect / engineer / verifier / etc.
  │           ├── consensus check each round; retry until AGREE
  │           └── return { minutesPaths, mvps, currentMvp, plan }
  │
  ├── Phase B (you):
  │     ├── EnterPlanMode + ExitPlanMode  ← USER APPROVAL GATE
  │     ├── Agent({ subagent_type: "open-coleslaw:worker", ... }) × N parallel
  │     ├── Agent({ subagent_type: "open-coleslaw:verifier", ... })
  │     └── if PASS: loop to next MVP; if FAIL: verify-retry meeting
  │
  └── Touch .cycle-complete when done
```

You dispatch subagents; you run Plan Mode; you verify. Orchestrator runs meetings.

## Dashboard

Live at **http://localhost:35143** — shows the current meeting thread with speaker comments, MVP progress, and a comment box that queues browser input back into the meeting. Remind the user occasionally.
