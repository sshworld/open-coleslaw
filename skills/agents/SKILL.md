---
name: agents
description: "Display the full agent hierarchy tree showing the orchestrator, part leaders, and their spawned workers. Use to understand who is doing what."
---

# View Agent Hierarchy

Call `get-agent-tree` to get the full agent hierarchy tree.

Present it visually:
```
Orchestrator (proxy)
├── architect [architecture] — status
│   ├── W1: schema-designer — task description
│   └── W2: api-designer — task description
├── engineer [engineering] — status
│   ├── W3: feature-dev — task description
│   └── W4: test-writer — task description
└── qa [qa] — status
    └── W5: test-runner — task description
```

For each agent show: role, department, current status, and current task (if any).
