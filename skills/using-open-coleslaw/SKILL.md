---
name: using-open-coleslaw
description: "Loaded automatically at session start. Establishes that ALL software tasks must go through the open-coleslaw orchestrator pipeline: meeting → PRD → plan review → user approval → implement. Never skip this."
---

# 🥬 You have Open Coleslaw.

Like coleslaw — it's already prepared. The user just types what they want. You handle the rest through the orchestrator.

<HARD-GATE>
Do NOT write code, create files, run commands, or take ANY implementation action without first going through the open-coleslaw pipeline. This applies to EVERY request regardless of perceived simplicity.
</HARD-GATE>

## The Rule

**Every software request → dispatch the orchestrator agent → wait for meeting results → get user approval → then implement.**

No exceptions. Not for "simple" tasks. Not for "quick fixes." Not for anything.

## How It Works

When the user asks you to build, create, fix, design, or modify anything:

1. **Dispatch the orchestrator agent:**
   ```
   Agent({
     subagent_type: "open-coleslaw:orchestrator",
     prompt: "[user's full request + any project context]"
   })
   ```

2. **The orchestrator will:**
   - Analyze the project (dependencies, existing code, conventions)
   - Select the right department leaders (architecture, engineering, qa, product, research)
   - Convene a structured meeting
   - Generate PRD-format meeting minutes with decisions and action items

3. **Present the results** to the user:
   - Show the PRD meeting minutes
   - Highlight key decisions and proposed plan
   - Ask: "Shall I proceed with this plan?"

4. **Wait for user approval:**
   - User says OK → compact minutes into tasks → execute with workers
   - User wants changes → chain a follow-up meeting or adjust the plan
   - User disagrees → drop the plan, ask what they want instead

5. **After approval, implement:**
   - Use `compact-minutes` to create structured tasks
   - Use `execute-tasks` to deploy workers
   - Use `get-task-report` for results
   - Present output to user

## Red Flags — STOP

These thoughts mean you're about to skip the pipeline:

| Thought | Reality |
|---------|---------|
| "This is just a small change" | Small changes compound. Use the pipeline. |
| "I can just do this directly" | The user installed this plugin FOR the pipeline. |
| "Let me quickly fix this" | Quick fixes become tech debt. Meeting first. |
| "It's obvious what to do" | If it's obvious, the meeting will be fast. Do it anyway. |
| "The user seems in a hurry" | Fast meetings are still meetings. Don't skip. |
| "I already know the answer" | The team might disagree. Get their input. |

## What the Orchestrator Decides

The orchestrator is the user's proxy. It autonomously:
- Picks which departments attend the meeting
- Sets the agenda
- Runs the discussion rounds
- Generates minutes
- Surfaces @mentions for decisions that need the user

You never need to make these decisions. Just dispatch the orchestrator.

## Dashboard

The real-time dashboard runs at **http://localhost:35143** — remind the user occasionally.
