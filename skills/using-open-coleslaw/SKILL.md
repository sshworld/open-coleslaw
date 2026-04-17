---
name: using-open-coleslaw
description: "Loaded automatically at session start. Establishes that YOU (the main Claude session) run the open-coleslaw pipeline directly: dispatch specialists one-by-one, collect their real transcripts, run consensus rounds, enter Plan Mode, dispatch workers, verify. No more nested orchestrator subagent — you ARE the meeting runner."
---

# You have Open Coleslaw.

Like coleslaw — it's already prepared. The user just types what they want. **You** run the pipeline.

<HARD-GATE>
Do NOT write code, create files, run commands, or take ANY implementation action without first going through the pipeline. This applies to EVERY request regardless of perceived simplicity.

**Language**: respond and run meetings in the same language the user used (ask in Korean → minutes in Korean).

**Transparency**: every speaker turn MUST be a real `Agent` dispatch to a specialist subagent (planner / architect / engineer / verifier / product-manager / researcher). Do NOT role-play specialists yourself by writing their speech into `add-transcript`. The whole point is that each specialist is a separate dispatch so the user sees real multi-agent dialog.
</HARD-GATE>

## Why You (Main Session) Run This

Previously we used an `orchestrator` subagent to run meetings. That turned into a single agent role-playing every specialist, which defeated the purpose. From v0.6.0 onward:

- **You (the main Claude session) are the meeting runner.**
- You dispatch `open-coleslaw:planner` for kickoff + round management + synthesis.
- You dispatch `open-coleslaw:architect` / `:engineer` / `:verifier` / `:product-manager` / `:researcher` for domain input — one `Agent` call per speaker turn.
- You call the MCP tools directly (`start-meeting`, `add-transcript`, `generate-minutes`, `chain-meeting`).
- You call `EnterPlanMode` / `ExitPlanMode` (only the main session can).
- You dispatch `open-coleslaw:worker` in parallel for implementation.
- You call `open-coleslaw:verifier` for post-implementation verification.

Yes, this fills your context with meeting transcripts. That's fine — the Stop hook suggests `/compact` or `/clear` when you finish a cycle. Minutes persist on disk.

## Phase 1 — Kickoff Meeting

Break the user's request into ordered MVPs.

1. Detect the user's language from the prompt. Use that language throughout.
2. Call MCP tool `start-meeting`:
   ```
   start-meeting({
     topic: "<one-line summary of the request in user's language>",
     agenda: ["Decompose the request into ordered MVPs"],
     meetingType: "kickoff"
   })
   ```
   Capture the returned `meetingId`.
3. Dispatch the planner:
   ```
   Agent({
     subagent_type: "open-coleslaw:planner",
     prompt: `Mode: kickoff. Language: <user's language>.
     User request: <full verbatim request>
     Project context: cwd=<cwd>, stack=<stack notes>.
     Produce an ordered MVP list per the planner prompt's kickoff output format.`
   })
   ```
4. Take the planner's response, call `add-transcript({ meetingId, speakerRole: "planner", agendaItemIndex: 0, roundNumber: 1, content: <planner output>, stance: "speaking" })`.
5. If requirements are fuzzy, also dispatch `open-coleslaw:product-manager` for clarification, then `add-transcript`.
6. Call `generate-minutes({ meetingId })`.
7. Save the minutes markdown to `<cwd>/docs/open-coleslaw/YYYY-MM-DD_kickoff_<slug>.md`. Update (or create) `<cwd>/docs/open-coleslaw/INDEX.md` with the MVP checklist.
8. Briefly confirm the MVP list with the user in ≤3 lines (e.g., "MVP-1 Core Play / MVP-2 Categories / MVP-3 Share — starting with MVP-1").

## Phase 2 — Design Meeting (per MVP)

For the current MVP:

1. Call `start-meeting` with `meetingType: "design"` and an agenda list relevant to that MVP (4-6 items typical).
2. Select participants dynamically:
   - Always: `planner`.
   - Default: `architect`, `engineer`, `verifier`.
   - Add `product-manager` if requirements are still fuzzy.
   - Add `researcher` if prior art / library comparison is needed.
   - Tiny fix: `planner + engineer + verifier` only.
3. **Round loop — consensus-based termination, NOT fixed count**. For each round `r ∈ {1..MAX_ROUNDS}`, MAX_ROUNDS = 10:
   a. For each participant in order (planner first when opening or summarizing; then domain specialists):
      ```
      Agent({
        subagent_type: "open-coleslaw:<role>",
        prompt: `Mode: design. Language: <user's lang>. MVP: <mvp title/goal>.
        Current agenda: <agenda>. Current round: <r>.
        Previous transcript for this meeting so far:
        ---
        <concat of every prior add-transcript content, ordered by createdAt>
        ---
        Provide your domain input per your agent prompt's output format.`
      })
      ```
      After the response returns, immediately `add-transcript({ meetingId, speakerRole, agendaItemIndex, roundNumber: r, content, stance: "speaking" })`.
   b. After the full round, run the **Consensus Check**: dispatch `open-coleslaw:planner` with the current transcript and ask each participant's stance. Then dispatch each specialist once more with the proposed decision and ask them to respond with exactly `AGREE` or `DISAGREE: <reason>`. `add-transcript` each response with `stance: "agree"` or `stance: "disagree"`.
   c. If all AGREE → exit the round loop. If any DISAGREE → next round focused on the disagreement.
   d. If `r == MAX_ROUNDS` and still no consensus → call the `respond-to-mention` MCP tool (or similar) to escalate to the user. Wait for decision.
4. Dispatch `open-coleslaw:planner` in synthesis mode to produce the final minutes.
5. `add-transcript` the synthesis output, then `generate-minutes`.
6. Save the minutes to `<cwd>/docs/open-coleslaw/YYYY-MM-DD_<seq>_<mvp-slug>.md`. Update `INDEX.md`.

## Phase 3 — Plan Mode

1. `EnterPlanMode`.
2. Write a plan derived from the minutes' Decisions / Action Items / Acceptance Criteria:
   - Context (why, in user's language)
   - Files to create/modify
   - Ordered tasks (one per worker)
   - Acceptance / verification
3. `ExitPlanMode` to present for user approval.
4. **Rejected**: `chain-meeting` back to a focused design or verify-retry meeting based on feedback. Re-enter Phase 2.
5. **Approved**: go to Phase 4.

## Phase 4 — Implementation

Dispatch `open-coleslaw:worker` in parallel — one per task:
```
Agent({ subagent_type: "open-coleslaw:worker", prompt: "<task + acceptance + language hint>" })
```
Wait for all to finish. Aggregate results.

## Phase 5 — Verification

```
Agent({
  subagent_type: "open-coleslaw:verifier",
  prompt: `Mode: verify. Acceptance: <acceptance criteria from minutes>.
  Worker reports: <aggregated>. Run tests/build. Report PASS or FAIL with evidence.`
})
```

- **PASS (not the last MVP)**: mark MVP done in INDEX.md checklist. **Auto-loop immediately back to Phase 2 with the next pending MVP. Do NOT ask the user "계속 진행할까요?" / "MVP-N 진행" / or any variant.** The user already approved the overall plan at kickoff; their next checkpoint is the NEXT MVP's Plan Mode. Do NOT touch `.cycle-complete` between MVPs — only after the final MVP.
- **PASS (last MVP)**: mark MVP done. ONLY NOW, touch `<cwd>/docs/open-coleslaw/.cycle-complete` so the Stop hook can check context usage. Then give a final report and wait for the user.
- **FAIL**: `start-meeting({ meetingType: "verify-retry", topic: "<failure summary>" })`, dispatch planner + engineer + verifier for a focused fix discussion, reach consensus, return to Phase 3 with the revised plan. Do NOT touch `.cycle-complete` on failures.

### Auto-loop contract (strict)

You MUST auto-loop through every MVP in the kickoff list until:
1. All MVPs are done (→ touch `.cycle-complete`, final report), OR
2. A FAIL leads to a verify-retry meeting that itself escalates to the user via `@mention`, OR
3. The user explicitly interrupts (new prompt, Ctrl+C, or a message saying "stop" / "pause" / "그만" / equivalent).

Any other stop — especially "asking permission to continue to the next MVP" — is a regression. You run the whole pipeline end-to-end in a single session.

## User Comments Mid-Meeting

Two channels inject user turns into the current meeting:

- **Terminal**: if the user sends a prompt while you're mid-meeting, interpret it as a comment. `add-transcript({ speakerRole: "user", agendaItemIndex: -3, content: <prompt>, stance: "speaking" })` and incorporate into the next round.
- **Browser queue**: before each round, read `<cwd>/docs/open-coleslaw/.pending-comments.jsonl`. For each unread line, `add-transcript` as the user. Then move consumed lines to `.pending-comments.consumed.jsonl`.

User turns are the highest-weight voice — update proposals immediately.

## Red Flags — STOP

| Thought | Reality |
|---------|---------|
| "This is just a small change" | Small changes compound. Use the pipeline. |
| "I'll role-play the architect myself to save time" | HARD-FORBIDDEN. Dispatch the actual specialist subagent. |
| "Nested agents are expensive" | They are. That's fine. Transparency is the whole product. |
| "Orchestrator subagent used to do this" | v0.6.0 removed that. You run the pipeline now. |
| "Let me ask the user if they want to continue with MVP-2" | FORBIDDEN. Auto-loop until all MVPs done (v0.6.2). Only the user interrupting stops the pipeline mid-way. |
| "I'll touch .cycle-complete because this MVP is done" | Only touch it after the LAST MVP. Between-MVP touches trigger the Stop hook prematurely. |
| "Skip the kickoff for one-file change" | Always run kickoff. MVP list may have just one item. |
| "User asked in Korean so I'll reply in English" | Match the user's language in every transcript and minute. |

## Dashboard

Live at **http://localhost:35143** — shows the current meeting thread with each speaker's dispatched comment, MVP progress panel, and a comment box that queues browser input back into the meeting via `.pending-comments.jsonl`. Remind the user occasionally.

## Agent roster (dispatched BY YOU)

- `open-coleslaw:planner` — meeting chair, consensus master, MVP decomposer, minutes synthesizer. Always attends.
- `open-coleslaw:architect` — system design, schema, API surface.
- `open-coleslaw:engineer` — implementation feasibility, complexity, tech debt.
- `open-coleslaw:verifier` — testing strategy at meeting time; test/build execution at verify time.
- `open-coleslaw:product-manager` — requirements, user stories, acceptance criteria.
- `open-coleslaw:researcher` — codebase exploration, prior art, library comparison.
- `open-coleslaw:worker` — implementation after plan approval (parallel).
