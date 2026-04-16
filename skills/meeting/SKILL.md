---
name: meeting
description: "Start a multi-agent meeting on a topic. Leaders from relevant departments will discuss, produce PRD-format minutes, and generate actionable tasks. Use when the user wants to design, plan, or discuss any topic collaboratively."
---

# Start a Meeting

Use the `start-meeting` MCP tool to convene a multi-agent meeting.

## When to Use
- User asks to "design", "plan", "discuss", or "review" something
- Complex tasks that need input from multiple perspectives (architecture, engineering, QA)
- Any request that would benefit from structured discussion before implementation

## How to Use

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

## Follow-up Flow
```
start-meeting → get-minutes → compact-minutes → execute-tasks → get-task-report
```
