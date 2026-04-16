---
name: meeting
description: "Use for ANY user request that involves building, creating, designing, fixing, or modifying software. The orchestrator ALWAYS starts by convening a meeting first — no exceptions. Even simple requests go through: meeting → PRD minutes → plan review → user approval → compact → implement. This is the core open-coleslaw workflow."
---

# The Open Coleslaw Workflow

**Every request flows through this pipeline. No exceptions.**

```
User prompt → Meeting → PRD Minutes → Plan Review → User "OK" → Compact → Implement
```

The user just types what they want. You handle the rest.

## Step 1: Convene Meeting

For ANY user request (build, create, fix, design, anything):

1. Analyze the request and select relevant departments
2. Create 2-4 agenda items
3. Call `start-meeting`:

```
start-meeting({
  topic: "user's request summarized",
  agenda: ["requirement analysis", "technical approach", "implementation plan", ...],
  departments: ["architecture", "engineering", ...]
})
```

## Step 2: Show PRD Minutes

After the meeting completes:

1. Call `get-minutes` with the meetingId
2. Present the PRD meeting minutes to the user
3. Highlight key **decisions** and **action items**

## Step 3: Plan Review — Wait for User Approval

**Do NOT proceed to implementation until the user says OK.**

Present the plan and ask:
- "Here are the meeting results and proposed plan. Shall I proceed with implementation?"
- If user wants changes → refine the plan or call `chain-meeting` for follow-up
- If user says OK → proceed to Step 4

## Step 4: Compact and Implement

1. Call `compact-minutes` to create structured tasks
2. Call `execute-tasks` to deploy workers
3. Call `get-task-report` for results
4. Present the final output to the user

## Available Departments
- `architecture` — system design, API, schema
- `engineering` — implementation, code quality
- `qa` — testing, security, performance
- `product` — requirements, user stories
- `research` — codebase exploration, prior art
