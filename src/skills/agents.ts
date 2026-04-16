/**
 * /agents skill — prompt generator.
 *
 * Returns instructions for Claude Code to invoke the get-agent-tree tool
 * and display the agent hierarchy.
 */

export function getAgentsSkillPrompt(args?: string): string {
  const filter = args?.trim();

  if (filter) {
    return [
      '<command-name>agents</command-name>',
      '',
      '## Agents Skill',
      '',
      `Show the agent hierarchy filtered by: **${filter}**`,
      '',
      'Steps:',
      '1. Invoke the `get-agent-tree` MCP tool to retrieve the full agent tree',
      '2. Filter the tree to show only agents matching the query',
      '   - Match against: agent ID, role, department, or status',
      '3. Display the matching agents in a tree-like format:',
      '',
      '```',
      'Orchestrator (root)',
      '  └─ eng-leader [active] — Engineering',
      '       └─ eng-worker-1 [running] — "Implement auth API"',
      '       └─ eng-worker-2 [idle]',
      '  └─ design-leader [active] — Design',
      '```',
      '',
      'For each agent show:',
      '- Role and department',
      '- Current status',
      '- Active task (if any)',
      '- Cost accumulated',
    ].join('\n');
  }

  return [
    '<command-name>agents</command-name>',
    '',
    '## Agents Skill',
    '',
    'Display the full Open-Coleslaw agent hierarchy.',
    '',
    'Steps:',
    '1. Invoke the `get-agent-tree` MCP tool to retrieve the agent tree',
    '2. Display the hierarchy in a tree-like format:',
    '',
    '```',
    'Orchestrator (root)',
    '  └─ eng-leader [active] — Engineering Department',
    '       └─ eng-worker-1 [running] — "Implement auth API"',
    '       └─ eng-worker-2 [completed] — "Write user model"',
    '  └─ design-leader [active] — Design Department',
    '       └─ design-worker-1 [running] — "Create wireframes"',
    '  └─ qa-leader [idle] — QA Department',
    '```',
    '',
    'For each agent, show:',
    '- **Role** and **department**',
    '- **Status**: idle, active, running, completed, failed',
    '- **Active task**: current task description (if running)',
    '- **Cost**: tokens/cost accumulated (if available)',
    '',
    'If no agents exist, report that the system has no active agents.',
    'Suggest the user start a meeting to spawn agents.',
  ].join('\n');
}
