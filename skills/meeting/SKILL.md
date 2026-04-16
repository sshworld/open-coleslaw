---
name: meeting
description: "ONLY use when the user EXPLICITLY asks for a meeting, discussion, design review, or multi-team collaboration. Do NOT use for simple build/create requests — those should be handled directly without a meeting. Trigger words: 'meeting', 'discuss', 'review together', 'get opinions from', 'design review', 'let the team discuss'."
---

# Start a Meeting

Use the `start-meeting` MCP tool to convene a multi-agent meeting.

## IMPORTANT: When NOT to Use

Do NOT start a meeting when the user simply says:
- "만들어줘" / "build this" / "create X" — just build it directly
- "fix this bug" — just fix it
- "add a feature" — just implement it

A meeting is ONLY appropriate when:
- User explicitly says "회의해줘", "discuss", "let's review", "get team input"
- The task requires trade-off analysis between multiple architectural approaches
- There's genuine ambiguity that needs multiple perspectives

**When in doubt, just do the work. Don't hold a meeting for something you can build directly.**

## How to Use (when a meeting IS appropriate)

1. Extract the **topic** from the user's request
2. Break it into **agenda items** (2-4 specific discussion points)
3. Call the `start-meeting` tool:

```
start-meeting({
  topic: "the topic",
  agenda: ["agenda item 1", "agenda item 2", ...],
  departments: ["architecture", "engineering"]  // optional, auto-selected if omitted
})
```

4. After the meeting completes, show the user the **meeting minutes** using `get-minutes`
5. If the user wants to execute the decisions, use `compact-minutes` then `execute-tasks`

## Available Departments
- `architecture` — system design, API, schema
- `engineering` — implementation, code quality
- `qa` — testing, security, performance
- `product` — requirements, user stories
- `research` — codebase exploration, prior art
