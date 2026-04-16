---
name: meeting
description: "Use for ANY user request involving building, creating, designing, fixing, or modifying software. Dispatches the orchestrator agent who manages the entire meeting → plan → implement pipeline."
---

# Open Coleslaw Workflow

**Every request goes through the orchestrator. You never call MCP tools directly.**

## What to Do

Dispatch the `open-coleslaw:orchestrator` agent with the user's request. The orchestrator handles everything:

1. Use the **Agent tool** to spawn the orchestrator:
   ```
   Agent({
     subagent_type: "open-coleslaw:orchestrator",
     prompt: "[the user's full request]"
   })
   ```

2. The orchestrator will:
   - Analyze the project (dependencies, existing code)
   - Select the right department leaders
   - Convene a structured meeting
   - Generate PRD meeting minutes
   - Present the plan to the user for approval
   - On approval: compact tasks and deploy workers

3. **You do NOT call start-meeting, get-minutes, compact-minutes, or execute-tasks directly.**
   The orchestrator agent handles all of that.

4. When the orchestrator returns with the meeting results/plan, present them to the user and ask for approval before proceeding.

## That's it.

Just dispatch the orchestrator with the user's request. The orchestrator is the user's proxy — it knows how to run the team.
