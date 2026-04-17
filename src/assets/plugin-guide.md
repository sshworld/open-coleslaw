# Open-Coleslaw Plugin Guide

## Overview
Multi-agent orchestrator for Claude Code. Flat dispatch:
- The main Claude session is the meeting runner — it dispatches each specialist
  one-by-one as its own subagent call, collects real transcripts, runs consensus
  rounds, enters Plan Mode, dispatches workers, verifies.
- Previously there was an `orchestrator` subagent; that layer was removed in
  v0.6.0 because it ended up role-playing every specialist instead of truly
  dispatching them. Now there's no role-play — every speaker turn is a real
  `Agent` call.

## Available Skills
- `/meeting [topic]` — Start the open-coleslaw pipeline
- `/using-open-coleslaw` — Trigger the full pipeline on any request
- `/status` — Show current meetings, agents, and pending mentions
- `/dashboard` — Open web dashboard at http://localhost:35143
- `/mention` — View and respond to pending @mentions
- `/agents` — Show full agent hierarchy tree
- `/minutes [meetingId]` — View meeting minutes

## Available Hooks
- `session-start` — Injects the using-open-coleslaw skill into every session
- `stop` — On cycle completion, checks context usage and suggests /compact or /clear

## Agent Tiers
| Tier | Model | Role |
|------|-------|------|
| Meeting runner (main session) | user's Claude Code model | Dispatches everyone |
| Specialist subagent | inherits | One per speaker turn: planner / architect / engineer / verifier / product-manager / researcher |
| Worker subagent | inherits | One per implementation task (parallel) |

No model is hard-coded. Every agent runs on whatever model the user's
Claude Code session is configured with.

## Departments
- Planning: meeting facilitation, MVP decomposition, consensus, minutes
- Architecture: system design, API, schema
- Engineering: implementation, code quality
- Verification: testing, security, performance, post-implementation runs
- Product: requirements, user stories
- Research: codebase exploration, docs

## Meeting Minutes
Saved to: `{project}/docs/open-coleslaw/`
Index: `{project}/docs/open-coleslaw/INDEX.md`
Format: PRD with decisions, rationale, action items, open questions
