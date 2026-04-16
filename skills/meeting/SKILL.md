---
name: meeting
description: "Use for ANY user request involving building, creating, designing, fixing, or modifying software. Dispatches the orchestrator agent who manages the entire meeting → plan → implement pipeline."
---

# Open Coleslaw Meeting

**Dispatch the orchestrator agent with the user's request. That is all.**

Use the **Agent tool** to spawn the orchestrator:

```
Agent({
  subagent_type: "open-coleslaw:orchestrator",
  prompt: "[the user's full request]"
})
```

The orchestrator handles everything from there:
- Convenes the right department leaders (arch, eng, qa, pm, research)
- Runs a structured meeting via MCP tools
- Generates PRD meeting minutes
- Presents the plan for user approval
- On approval: dispatches implementer agents for each task

You do NOT call MCP tools directly. You do NOT call leader agents directly. The orchestrator is the single entry point.
