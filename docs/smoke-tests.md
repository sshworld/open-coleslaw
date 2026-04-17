# Open Coleslaw — Runtime Smoke Test Checklist

`npm test` passing is NEVER enough. Before calling a version "ready", walk this
checklist in a **real Claude Code session**. Paste the release version you are
checking in the `Version:` field, then mark each item ✅ or ❌.

```
Version: 0.6.x
Date: YYYY-MM-DD
Model active in Claude Code: Opus / Sonnet / Haiku — ________
```

## 1. Install and load

- [ ] `/plugin uninstall open-coleslaw` then `/plugin install open-coleslaw@sshworld`
- [ ] Start a **completely new** Claude Code session (not `/continue`)
- [ ] Session start banner shows: `🥬 Open Coleslaw loaded — View Dashboard Live @ http://localhost:35143`
- [ ] `/plugin list` shows open-coleslaw at the version under test
- [ ] Dashboard loads at http://localhost:35143 (empty state with "No meeting in progress" is fine)

## 2. Real multi-agent dispatch (the v0.5.x regression we are guarding against)

Prompt: `밸런스게임 만들어줘` (or any non-trivial software request).

During the run, watch the terminal transcript (Ctrl+O to expand). Expect to see
at least one `Agent(...)` call per role in the terminal, NOT just one single
`open-coleslaw:orchestrator(...)` wrapping the entire meeting.

- [ ] Terminal shows `Agent(open-coleslaw:planner ...)` at least once
- [ ] Terminal shows `Agent(open-coleslaw:architect ...)` at least once
- [ ] Terminal shows `Agent(open-coleslaw:engineer ...)` at least once
- [ ] Terminal shows `Agent(open-coleslaw:verifier ...)` at least once
- [ ] Terminal does **NOT** show any `Agent(open-coleslaw:orchestrator ...)` — that agent was removed in v0.6.0
- [ ] Each specialist's dispatch is immediately followed by an
      `add-transcript` MCP call

If a specialist only appears as speech inside add-transcript without a matching
`Agent(...)` dispatch above it, the main session is role-playing — ❌ fail.

## 3. Dashboard realtime view

While the meeting is running:

- [ ] Open http://localhost:35143 in a browser (refresh if needed)
- [ ] A tab exists for the current project (e.g., "balance-game")
- [ ] The main thread area populates with comments as each specialist is dispatched
- [ ] Speaker avatars/colors differ per role (planner / architect / engineer / verifier)
- [ ] "MVP Progress" sidebar shows the kickoff MVP list
- [ ] Comment box at the bottom is enabled (not greyed out) during the meeting
- [ ] Opening the same project in a **second** terminal does **not** create
      a duplicate `balance-game (1)` tab — the existing tab stays

## 4. Past meetings view

After the kickoff minutes are written but before the design meeting completes,
OR after completion:

- [ ] A past meeting appears in the sidebar "Past Meetings" list
- [ ] Clicking the past meeting swaps the main view to show that thread
- [ ] A purple "Back to live meeting" banner appears
- [ ] Clicking "Back to live meeting" returns to the current in-progress meeting

## 5. Plan Mode enters from the main session

After the design meeting reaches consensus:

- [ ] Plan Mode activates in the main session (native UI, not a plain-text plan)
- [ ] The plan references files, tasks, and acceptance criteria from the minutes
- [ ] Approving the plan dispatches `Agent(open-coleslaw:worker ...)` calls in parallel
- [ ] The verifier runs tests/build after workers finish

## 6. Language match

Prompt in Korean (`밸런스게임 만들어줘`):

- [ ] Meeting topic is Korean in the dashboard
- [ ] Every specialist's transcript is in Korean
- [ ] Minutes markdown in `docs/open-coleslaw/` is in Korean (decisions / rationale / action items)
- [ ] Technical identifiers (file paths, function names) stay in natural English

Prompt in English on a different project:

- [ ] Same, but in English

## 7. Consensus-based termination

During any design meeting:

- [ ] Number of rounds depends on agreement, not a fixed count (observe: 1 round if easy, 2-3+ if contested)
- [ ] Planner calls a consensus check round after each speaker turn
- [ ] A DISAGREE response opens another round focused on the disagreement
- [ ] After all-AGREE, planner synthesizes minutes

## 8. Minutes persistence

After the meeting:

- [ ] `docs/open-coleslaw/INDEX.md` exists and lists the MVPs as a checklist
- [ ] `docs/open-coleslaw/YYYY-MM-DD_kickoff_<slug>.md` exists
- [ ] `docs/open-coleslaw/YYYY-MM-DD_001_<slug>.md` (design) exists
- [ ] Files are readable as git-diffable markdown (no weird encoding)

## 9. Auto-loop across all MVPs (v0.6.2 regression guard)

Use a prompt that decomposes into 2+ MVPs (e.g., a meaningful app, not a one-liner fix):

- [ ] After MVP-1's verifier reports PASS, the main session **automatically** starts MVP-2's design meeting
- [ ] The main session does **NOT** ask "MVP-2 진행할까요?" / "계속할까요?" / any variant between MVPs
- [ ] `docs/open-coleslaw/.cycle-complete` is **NOT** present after MVP-1 completes
- [ ] `.cycle-complete` is touched ONLY after the final MVP's verifier reports PASS
- [ ] Between-MVP user checkpoints happen ONLY at each MVP's Plan Mode approval gate
- [ ] User CAN interrupt at any point (Ctrl+C or a new prompt) and the pipeline stops

## 10. Cycle complete + Stop hook

After ALL MVPs are done:

- [ ] Marker file `docs/open-coleslaw/.cycle-complete` exists
- [ ] Stop hook reads transcript usage; if ≥30%, emits `systemMessage`
      suggesting `/compact` or `/clear`
- [ ] The marker is deleted after the hook fires (so the next regular turn
      does not get nagged)

## 11. User comments mid-meeting

### Terminal channel:

- [ ] While a meeting is running, type a follow-up prompt
- [ ] The follow-up shows up as a `speakerRole: user` transcript in the thread
- [ ] The next round incorporates the user's input

### Browser channel:

- [ ] Type a comment into the dashboard comment box and press Enter
- [ ] The comment appears instantly in the thread (optimistic render)
- [ ] `docs/open-coleslaw/.pending-comments.jsonl` contains the entry
- [ ] The next round consumes the comment and appends it to the transcript;
      consumed entries move to `.pending-comments.consumed.jsonl`

---

## How to report a failure

If any checkbox is ❌, open a session log dump (Ctrl+O in the terminal) and
include:
- Version under test
- Model active in Claude Code
- Exact prompt that triggered the failure
- Which checkbox failed and the observed behavior
- Relevant lines from the terminal transcript

This replaces the (insufficient) assumption that green `npm test` means
"it works". The smoke test is the real gate.
