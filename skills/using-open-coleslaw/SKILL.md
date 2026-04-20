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

## Phase 0 — Enter Plan Mode

The meeting IS the planning. The moment you are about to dispatch the **first
planner** (kickoff or per-MVP design), you are entering planning. Therefore:

1. Call `EnterPlanMode()` **before** the first planner dispatch of the current
   planning cycle.
2. **Mirror to the dashboard (MANDATORY)**: immediately after `EnterPlanMode`,
   call `announce-plan-state({ phase: "entered", cycle: "kickoff" | "design" | "verify-retry" })`.
   Without this call the dashboard has no idea plan mode is active.
3. Stay in plan mode through Phase 1 (Clarify + Kickoff) and Phase 2 (Design).
4. Exit plan mode only at Phase 3 via `ExitPlanMode({ plan })` — and announce
   the `plan-presented` + `resolved` phases around it.

Why plan mode for the whole meeting:
- MCP tools (`start-meeting`, `add-transcript`, `generate-minutes`) work in plan mode.
- `Agent(...)` dispatches work in plan mode.
- `AskUserQuestion(...)` works in plan mode (needed for Phase 1 clarify).
- Disk writes (minutes markdown, INDEX.md, `.pending-comments.consumed.jsonl`)
  DO NOT work in plan mode. Defer those until `ExitPlanMode` + user approval.

## Phase 1 — Clarify + Kickoff

This phase runs ONCE per user request (not per MVP). It breaks the request
into an ordered MVP list, and first asks the user back if anything is fuzzy.

1. Detect the user's language from the prompt. Use that language throughout.
2. Call MCP tool `start-meeting`:
   ```
   start-meeting({
     topic: "<one-line summary of the request in user's language>",
     agenda: ["Understand user's needs", "Decompose the request into ordered MVPs"],
     meetingType: "kickoff"
   })
   ```
   Capture the returned `meetingId`.
3. **Clarify step** — dispatch the planner in clarify sub-mode:
   ```
   Agent({
     subagent_type: "open-coleslaw:planner",
     prompt: `Mode: kickoff/clarify. Language: <user's language>.
     User request: <full verbatim request>
     Project context: cwd=<cwd>, stack=<stack notes>.
     Follow your planner prompt's "Sub-mode A: clarify" contract exactly.
     Return EITHER a NEEDS_CLARIFICATION block with structured questions,
     OR the literal token "READY".`
   })
   ```
   `add-transcript` the response with `speakerRole: "planner", agendaItemIndex: 0, roundNumber: 1, stance: "speaking"`.

   **If the planner returned `NEEDS_CLARIFICATION`:**
   - Parse the structured questions list.
   - **Mirror to the dashboard (MANDATORY)**: before the actual
     `AskUserQuestion` call, announce via `announce-plan-state({ phase: "clarify-asked", questions: [...] })`
     with the parsed questions + options so the dashboard sidebar shows
     them.
   - Call `AskUserQuestion({ questions: [...] })` translating each planner
     question into the tool's schema (question + multiSelect:false + options).
     **Always include a final "다른 의견 / Other" open-text option** for every
     question so the user can override your predefined choices.
   - Wait for the user's answers.
   - **Mirror to the dashboard (MANDATORY)**: after answers arrive, call
     `announce-plan-state({ phase: "clarify-answered", answers: [...] })`.
   - `add-transcript` the user's answers with `speakerRole: "user", agendaItemIndex: 0, roundNumber: 1, stance: "speaking"`.
   - **Non-default / custom answer handling (MANDATORY)**: if ANY answer was
     the "Other" free-text option OR the user's reply diverges from your
     predefined options in content, treat it as **new constraints** — you MUST
     re-dispatch the planner in clarify sub-mode again with the custom answer
     included in the prompt, not skip directly to decompose. Only when all
     answers are within-options AND the planner then returns `READY` do you
     proceed to step 4. Recording the transcript without re-engaging the
     planner is a silent failure — **the user's feedback must trigger another
     planner turn**.

   **If the planner returned `READY`:** skip straight to step 4.

4. **Decompose step** — re-dispatch the planner in decompose sub-mode with any
   clarifications appended:
   ```
   Agent({
     subagent_type: "open-coleslaw:planner",
     prompt: `Mode: kickoff/decompose. Language: <user's language>.
     User request: <full verbatim request>
     User clarifications: <answers from AskUserQuestion, or "none needed">
     Project context: cwd=<cwd>, stack=<stack notes>.
     Produce an ordered MVP list per the planner prompt's decompose format.`
   })
   ```
   `add-transcript` the response with `agendaItemIndex: 1, roundNumber: 1, stance: "speaking"`.

5. (Optional) if requirements are still fuzzy after clarify, dispatch
   `open-coleslaw:product-manager`, `add-transcript` their input, then
   re-dispatch planner once more for refinement.
6. Call `generate-minutes({ meetingId })` to write the kickoff record to SQLite.
7. **Register MVPs (MANDATORY)** — call `update-mvps`:
   ```
   update-mvps({
     kickoffMeetingId: <current meetingId>,
     mvps: [
       { id: "mvp-1", title: "...", goal: "...", status: "in-progress", orderIndex: 0 },
       { id: "mvp-2", title: "...", goal: "...", status: "pending",     orderIndex: 1 },
       ...
     ]
   })
   ```
   This populates the dashboard's MVP Progress sidebar. Without this call the
   sidebar stays empty even though the minutes contain the MVP list.
8. **DO NOT** write the kickoff markdown file yet. You are still in plan mode
   — disk writes happen after Phase 3 approval.
9. Hold the MVP list in working memory. Move straight to Phase 2 for MVP-1.

## Phase 2 — Design Meeting (per MVP)

**EVERY MVP gets its own design meeting.** Even if the user said "just do MVP 2~5" or "continue with the rest". Do NOT short-circuit to Phase 4 (implementation) because you think the kickoff already contains enough detail — the kickoff only produced high-level MVP titles and scope notes; the actual design decisions (files, tasks, acceptance criteria) only exist after a design meeting.

**PLANNER IS MANDATORY.** Every design meeting MUST dispatch `open-coleslaw:planner` AT LEAST three times:

1. **Opening** — planner states the agenda and target MVP scope.
2. **Each consensus check** — planner queries participant stances after every round.
3. **Synthesis** — planner writes the final minutes.

If you close a meeting without any `Agent(open-coleslaw:planner ...)` dispatch, that meeting is invalid — discard and restart. No exceptions.

For the current MVP:

0. **Mark this MVP as in-progress (MANDATORY)**: `update-mvps({ patch: { id: "<mvp-id>", status: "in-progress" } })`. This is how the dashboard's MVP Progress sidebar moves the row into the active state. For MVP-2+ this is also how the sidebar clears the previous in-progress marker.
1. Call `start-meeting` with `meetingType: "design"` and an agenda list relevant to that MVP (4-6 items typical).
2. Select participants dynamically:
   - **Always**: `planner` (mandatory, see above).
   - Default: `architect`, `engineer`, `verifier`.
   - Add `product-manager` if requirements are still fuzzy.
   - Add `researcher` if prior art / library comparison is needed.
   - Tiny fix: `planner + engineer + verifier` only. Planner is still required.
3. **Opening**: dispatch `open-coleslaw:planner` to open the meeting. `add-transcript` the result with `agendaItemIndex: -1, roundNumber: 0, stance: "speaking"`.
4. **Round loop — consensus-based termination, NOT fixed count**. For each round `r ∈ {1..MAX_ROUNDS}`, MAX_ROUNDS = 10:
   a. For each domain specialist in order (architect → engineer → verifier → other convened specialists):
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
   b. **Consensus check (MANDATORY every round)**: dispatch `open-coleslaw:planner` to propose a concrete decision statement from this round's transcript. `add-transcript` the planner's proposal. Then dispatch each specialist ONCE more with that proposal and ask for exactly `AGREE` or `DISAGREE: <reason>`. `add-transcript` each response with `stance: "agree"` or `stance: "disagree"`. This consensus-check planner dispatch is required even in round 1.
   c. If all AGREE → exit the round loop. If any DISAGREE → next round focused on the disagreement.
   d. If `r == MAX_ROUNDS` and still no consensus → call the `respond-to-mention` MCP tool (or similar) to escalate to the user. Wait for decision.
5. **Synthesis (MANDATORY)**: dispatch `open-coleslaw:planner` in synthesis mode to produce the final minutes.
6. `add-transcript` the synthesis output with `agendaItemIndex: -2, stance: "speaking"`, then `generate-minutes`.
7. **DO NOT** write the design minutes markdown yet. Still in plan mode — disk writes happen after Phase 3 approval.

## Phase 3 — Exit Plan Mode (present plan for approval)

You are still in plan mode from Phase 0. The design meeting produced concrete
decisions, rationale, and action items. Now surface them as the plan.

1. Build the plan string from the design minutes:
   - Context (why, in user's language)
   - Files to create/modify
   - Ordered tasks (one per worker)
   - Acceptance / verification
2. **Mirror to the dashboard (MANDATORY)**: call
   `announce-plan-state({ phase: "plan-presented", plan: <plan string> })`
   **before** `ExitPlanMode`. This lets browser users see the exact plan
   being surfaced in the terminal.
3. Call `ExitPlanMode({ plan: <plan string> })`.
4. **Rejection detection (MANDATORY — do not skip)**: After `ExitPlanMode`,
   check what the user returned. The plan is ONLY approved when the user's
   response is an unambiguous approval (e.g., "approve", "yes", "go ahead",
   "진행해", empty + continue, or Claude Code's native "plan approved" signal).
   Any of the following means REJECTED and triggers step 3 below:
   - User picked a non-approval option from Claude Code's plan-mode UI
   - User replied with "no" / "stop" / "wait" / "아니" / "다른 방향" / any
     redirect, pushback, alternative suggestion, or new constraint
   - User supplied a "다른 의견 / Other" free-text answer describing a
     different approach
   - User asked a question that implies the plan is wrong ("왜 X 안 했어?",
     "이건 Y 해야 하지 않나?")

   When rejected: `add-transcript` the user's feedback with
   `speakerRole: "user", stance: "disagree"`, then follow step 5 below.
5. **Rejected — you MUST re-open a meeting, not just record feedback**:
   - Announce to dashboard: `announce-plan-state({ phase: "resolved", outcome: "rejected", feedback: "<summary of user's pushback>" })`.
   - You are still in plan mode. Do NOT call `ExitPlanMode` again with the
     same plan.
   - Call `chain-meeting({ fromMeetingId: <current>, newTopic: "<rejection summary>", meetingType: "design" | "verify-retry" })`.
   - Return to Phase 2 step 2 (select participants), running a **full new
     design round** with the user's feedback pre-seeded in the opening
     transcript as the highest-weight input.
   - Only after the new consensus is reached and a revised plan is
     synthesised do you call `ExitPlanMode` again (and announce `plan-presented` / `resolved` again).
   - **Silent failure mode (forbidden)**: recording the user's feedback via
     `add-transcript` and then doing nothing — or trying to patch the plan
     yourself without re-convening specialists — is a regression. The user
     pushed back; the pipeline owes them another meeting.
6. **Approved** — Claude Code's ExitPlanMode returns the user's choice
   (auto-accept vs manual-approve). Announce it immediately:
   `announce-plan-state({ phase: "resolved", outcome: "auto-accept" | "manual-approve" })`.
   You are now out of plan mode. IMMEDIATELY perform the deferred disk writes:
   - Write kickoff markdown to `<cwd>/docs/open-coleslaw/YYYY-MM-DD_kickoff_<slug>.md`
     (only if this is the first MVP of the session).
   - Write design markdown to `<cwd>/docs/open-coleslaw/YYYY-MM-DD_<seq>_<mvp-slug>.md`.
   - Create/update `<cwd>/docs/open-coleslaw/INDEX.md` with the MVP checklist.
   - Consume any queued `.pending-comments.jsonl` entries you saw during the meeting.
7. Go to Phase 4.

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

- **PASS (not the last MVP)**: mark MVP done via `update-mvps({ patch: { id: "<mvp-id>", status: "done" } })` AND update INDEX.md checklist. **Auto-loop immediately back to Phase 0 (re-enter plan mode) for the next pending MVP, then Phase 2 design meeting.** Skip Phase 1 — kickoff only runs once per session. Do NOT ask the user "계속 진행할까요?" / "MVP-N 진행" / or any variant. Their next checkpoint is the next MVP's `ExitPlanMode` approval. Do NOT touch `.cycle-complete` between MVPs — only after the final MVP.
- **PASS (last MVP)**: mark MVP done via `update-mvps({ patch: { id: "<mvp-id>", status: "done" } })`. ONLY NOW, touch `<cwd>/docs/open-coleslaw/.cycle-complete` so the Stop hook can check context usage. Then give a final report and wait for the user.
- **FAIL**: mark MVP blocked via `update-mvps({ patch: { id: "<mvp-id>", status: "blocked" } })`. Then `EnterPlanMode` again (verify-retry is another planning cycle), `start-meeting({ meetingType: "verify-retry", topic: "<failure summary>" })`, dispatch planner + engineer + verifier for a focused fix discussion, reach consensus, then `ExitPlanMode` with the revised plan. Do NOT touch `.cycle-complete` on failures. When the retry PASSes, move the MVP back to `done`.

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

## Follow-up Discussion (after minutes are finalised)

If more discussion happens **after** `generate-minutes` was called — for
example:
- user replies in the terminal or browser after the approve gate
- a verify-retry meeting sends fresh transcripts back to the original design meeting via `chain-meeting`
- another consensus round is triggered mid-implementation

…you MUST re-fold those turns into the existing minutes. The pipeline does
NOT lose them silently; the responsibility is yours:

1. `add-transcript(...)` each new speaker turn (user + specialists) to the
   same `meetingId`. Adding transcripts to a completed meeting is allowed —
   no code blocks it.
2. Call `generate-minutes({ meetingId })` **again**. The tool is idempotent
   and append-aware: it detects the new transcripts, appends a
   `## Follow-up Discussion — <timestamp>` section to the existing minutes
   (keeping the original Decisions / Action Items intact), and returns the
   updated content.
3. Overwrite the markdown file on disk (`docs/open-coleslaw/YYYY-MM-DD_*.md`)
   with the new content returned from `generate-minutes`. Do NOT create a
   second file — the same minutes file grows in place.
4. If the follow-up changes the action items, also patch the `update-mvps`
   status if it affects an MVP's completion state.

**Silent failure mode (forbidden)**: adding user / specialist transcripts
and then skipping the re-`generate-minutes` + file-overwrite step. Symptom:
dashboard thread shows the new comments, but the markdown on disk freezes
at the original snapshot and the user feels their follow-up "disappeared."

## Red Flags — STOP

| Thought | Reality |
|---------|---------|
| "This is just a small change" | Small changes compound. Use the pipeline. |
| "I'll role-play the architect myself to save time" | HARD-FORBIDDEN. Dispatch the actual specialist subagent. |
| "Nested agents are expensive" | They are. That's fine. Transparency is the whole product. |
| "Orchestrator subagent used to do this" | v0.6.0 removed that. You run the pipeline now. |
| "Let me ask the user if they want to continue with MVP-2" | FORBIDDEN. Auto-loop until all MVPs done (v0.6.2). Only the user interrupting stops the pipeline mid-way. |
| "I'll touch .cycle-complete because this MVP is done" | Only touch it after the LAST MVP. Between-MVP touches trigger the Stop hook prematurely. |
| "The user said 'do MVP 2-5', I'll skip meetings and just implement" | FORBIDDEN. Every MVP needs its own full design meeting (planner + specialists + consensus + minutes) before Plan Mode. Kickoff only gave titles, not design decisions. |
| "Planner is just a chair, I can summarize the meeting myself" | FORBIDDEN. Every meeting MUST include `Agent(open-coleslaw:planner ...)` dispatches at opening, each consensus check, and synthesis. If a meeting closes with zero planner dispatches, it is invalid — restart it. |
| "Skip the kickoff for one-file change" | Always run kickoff. MVP list may have just one item. |
| "I'll write minutes markdown mid-meeting to not lose it" | FORBIDDEN. You are in plan mode — disk writes are blocked. Keep minutes in SQLite via `generate-minutes`, flush to markdown AFTER `ExitPlanMode` approval. |
| "I'll skip EnterPlanMode because the request looks simple" | FORBIDDEN. Every planning cycle starts with `EnterPlanMode` before the first planner dispatch. The user's "approve" gate is `ExitPlanMode`. |
| "User gave clear requirements, no clarify needed" | Maybe — but still dispatch planner in `kickoff/clarify` mode first. If planner returns `READY`, you skip `AskUserQuestion` and proceed to decompose. Never bypass the clarify step. |
| "User picked the 'Other' / 4th option so I'll just record it and move on" | FORBIDDEN. Any non-default, custom, or out-of-options answer is **new constraints**. Re-dispatch planner in clarify sub-mode with the custom answer included — do not skip to decompose. |
| "User rejected the plan but I already captured their feedback as a transcript" | FORBIDDEN. Recording the rejection is step one. Step two is `chain-meeting` and running a **new full design meeting** with that feedback pre-seeded. Do not patch the plan yourself and re-`ExitPlanMode`. |
| "User said something ambiguous after ExitPlanMode, I'll assume approve" | FORBIDDEN. Only treat as approve if the reply is an unambiguous yes. Any pushback / question / alternative / "wait" / "아니" / "다른 방향" = REJECT → re-open meeting. When in doubt, re-open. |
| "Minutes are already generated, I can just add the user's follow-up to the thread and call it done" | FORBIDDEN. The dashboard thread will show the comment but the markdown on disk will freeze. You MUST call `generate-minutes` AGAIN (it's idempotent and append-aware) and overwrite the markdown file with the new content. |
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
