---
name: meeting
description: "Use for ANY user request involving building, creating, designing, fixing, or modifying software. YOU run the meeting pipeline directly — dispatching planner / architect / engineer / verifier one-by-one via the Agent tool, collecting their real output into add-transcript, reaching consensus, then entering Plan Mode. There is no orchestrator subagent; the main session IS the meeting runner. See the using-open-coleslaw skill for the full runbook."
---

# Open Coleslaw Meeting

**You (the main Claude session) run the meeting. Don't role-play specialists — dispatch them.**

One speaker turn = one `Agent` call with the specialist's `subagent_type`, followed by one `add-transcript` call that records what they said. That's how the dashboard and the minutes file get real multi-agent dialog instead of a single agent's monologue.

## Quick runbook

1. `start-meeting({ topic, agenda, meetingType: "kickoff" | "design" | "verify-retry" })` — captures `meetingId`.
2. `Agent({ subagent_type: "open-coleslaw:planner", prompt: "<mode + language + context>" })` → `add-transcript` with the result.
3. For each specialist you need (architect / engineer / verifier / product-manager / researcher), same pattern: one `Agent` dispatch, one `add-transcript` recording what they said. Always pass the full prior transcript in the prompt so each speaker "hears" the others.
4. After every full round, dispatch planner again for a **consensus check**: each specialist replies `AGREE` or `DISAGREE: <reason>`. Record stances with `stance: "agree" | "disagree"` in `add-transcript`. Only synthesize when every participant AGREEs. Max 10 rounds, then escalate to the user via `@mention`.
5. `generate-minutes` → save to `<cwd>/docs/open-coleslaw/YYYY-MM-DD_<seq>_<slug>.md`.
6. `EnterPlanMode` → write plan from the minutes → `ExitPlanMode` for user approval.
7. On approval: `Agent({ subagent_type: "open-coleslaw:worker", ... })` in parallel per task.
8. `Agent({ subagent_type: "open-coleslaw:verifier", ... })` for tests/build. PASS → next MVP or `.cycle-complete`. FAIL → `chain-meeting` with `meetingType: "verify-retry"` and re-plan.

## Language

Use the user's language (Korean → 한국어, English → English) for all speaker prompts, all `add-transcript` content, all minutes, and your own narration. Code, commands, and file paths stay in their natural form.

## Full detail

See `open-coleslaw:using-open-coleslaw` for the complete pipeline spec, consensus-check wording, participant-selection rules, and user-comment handling (terminal prompts and `.pending-comments.jsonl` browser queue).
