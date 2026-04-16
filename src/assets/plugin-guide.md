# Open-Coleslaw Plugin Guide

## Overview
Multi-agent orchestrator for Claude Code. Hierarchical agent system:
Orchestrator (proxy) → Part Leaders (team leads) → Workers (executors)

## Available Skills
- `/meeting [topic]` — Start a meeting (auto-selects leaders if topic given)
- `/status` — Show current meetings, agents, and pending mentions
- `/dashboard` — Open web dashboard at http://localhost:35143
- `/mention` — View and respond to pending @mentions
- `/agents` — Show full agent hierarchy tree
- `/minutes [meetingId]` — View meeting minutes

## Available Hooks
- `pre-read` — Loads rules + plugin guide + CLAUDE.md/README before execution
- `auto-route` — Analyzes user prompts and auto-routes to appropriate skill/agent
- `auto-commit` — Creates conventional commits after task completion
- `doc-update` — Updates CLAUDE.md/README.md after process completion
- `flow-verify` — Verifies PRD user flows after development
- `mvp-cycle` — Triggers re-meeting on verification failure

## Agent Tiers
| Tier | Model | Max Turns | Max Budget |
|------|-------|-----------|------------|
| Orchestrator | claude-sonnet-4-6 | 10 | $1.00 |
| Leader | claude-sonnet-4-6 | 20 | $2.00 |
| Worker (impl) | claude-sonnet-4-6 | 30 | $0.50 |
| Worker (research) | claude-haiku-4-5 | 10 | $0.10 |

## Departments
- Architecture: system design, API, schema
- Engineering: implementation, code quality
- QA: testing, security, performance
- Product: requirements, user stories
- Research: codebase exploration, docs

## Meeting Minutes
Saved to: ~/.open-coleslaw/minutes/
Index: ~/.open-coleslaw/minutes/INDEX.md
Format: PRD with frontmatter metadata + tags
