---
name: status
description: "Show current open-coleslaw status: active meetings, agent hierarchy, pending @mentions, and cost summary. Use when the user asks about ongoing work, agent status, or what's happening."
---

# Check Status

Show the user a comprehensive status overview of the open-coleslaw system.

## Steps

1. Call `get-meeting-status` with no arguments to get all active meetings
2. Call `get-mentions` with `{ status: "pending" }` to check for pending decisions
3. Call `get-agent-tree` to show the agent hierarchy
4. Call `get-cost-summary` for cost overview

## Format the Output

Present a concise summary:
- **Active Meetings**: count and topics
- **Pending @Mentions**: decisions waiting for user input (highlight these!)
- **Agent Hierarchy**: orchestrator → leaders → workers tree
- **Cost**: total spend and per-meeting breakdown
- **Dashboard**: remind user about http://localhost:35143
