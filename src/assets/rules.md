# Open-Coleslaw Rules

## Execution Rules
- Pre-read rules.md + plugin-guide.md + project CLAUDE.md/README.md before every execution
- If a user-requested routine doesn't exist, auto-create it (hook/skill/command/asset/loop) and register
- All features must be documented: "Feature X runs when Y happens"

## Meeting Rules
- Orchestrator is the user's proxy/delegate, NOT CEO — escalate important decisions via @mention
- Only leaders participate in meetings; workers are hired autonomously by leaders
- Meeting minutes must be in PRD format
- Meeting minutes are always saved to ~/.open-coleslaw/minutes/ with INDEX.md

## Development Rules
- Work in MVP cycles: meeting → develop → verify → (fail? → re-meeting)
- PRD user flows must be verified after development
- Use conventional commits when git is connected (feat/fix/docs/refactor/test/chore)
- Auto-update CLAUDE.md and README.md after process completion

## Agent Rules
- Follow tier-based model/context allocation (see plugin-guide.md)
- Workers: retry once on failure, then continue with partial results
- Leaders autonomously decide worker count based on task complexity
- Rule priority: rules.md > CLAUDE.md > conversation context
