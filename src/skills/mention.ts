/**
 * /mention skill — prompt generator.
 *
 * Returns instructions for Claude Code to invoke the get-mentions tool
 * and respond to any pending mentions.
 */

export function getMentionSkillPrompt(args?: string): string {
  const mentionId = args?.trim();

  if (mentionId) {
    return [
      '<command-name>mention</command-name>',
      '',
      '## Mention Skill',
      '',
      `Respond to mention: **${mentionId}**`,
      '',
      'Steps:',
      '1. Use the Open-Coleslaw MCP tools to retrieve the specific mention by ID',
      '2. Display the mention details:',
      '   - Summary of what the agent is asking',
      '   - Urgency level (blocking / advisory)',
      '   - Available options with descriptions',
      '   - Which agents support each option',
      '3. Ask the user for their decision',
      '4. Once the user decides, invoke the `respond-to-mention` tool with:',
      `   - **mentionId**: "${mentionId}"`,
      '   - **decision**: the user\'s chosen option label',
      '   - **reasoning**: the user\'s reasoning (or a summary)',
      '',
      'Important:',
      '- If the mention is "blocking", the meeting is paused waiting for this response',
      '- Present the options clearly so the user can make an informed choice',
    ].join('\n');
  }

  return [
    '<command-name>mention</command-name>',
    '',
    '## Mention Skill',
    '',
    'Check for and respond to pending @mentions.',
    '',
    'Steps:',
    '1. Invoke the `get-mentions` MCP tool to retrieve all pending mentions',
    '2. If there are no pending mentions, report that to the user',
    '3. If there are pending mentions, display each one with:',
    '   - Meeting context (which meeting raised the mention)',
    '   - Summary of the question / decision needed',
    '   - Urgency: **blocking** (meeting paused) or **advisory** (informational)',
    '   - Available options with descriptions and supporter list',
    '4. For each blocking mention, ask the user for their decision',
    '5. For each decision, invoke the `respond-to-mention` tool with:',
    '   - **mentionId**: the mention\'s ID',
    '   - **decision**: the chosen option label',
    '   - **reasoning**: user\'s reasoning',
    '',
    'If multiple mentions are pending, handle them one at a time,',
    'starting with blocking mentions (highest urgency first).',
  ].join('\n');
}
