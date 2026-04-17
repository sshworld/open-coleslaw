# Open-Coleslaw Plugin Guide

## Overview
Multi-agent orchestrator for Claude Code. 2-phase pipeline:
- Phase A: orchestrator subagent runs meetings (kickoff + per-MVP design).
- Phase B: main Claude session runs Plan Mode + worker dispatch + verification.

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
| Orchestrator (subagent) | inherits from user session | Meeting runner |
| Leader (specialist) | inherits from user session | Meeting participant |
| Worker | inherits from user session | Implementation |

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
