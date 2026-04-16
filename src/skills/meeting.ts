/**
 * /meeting skill — prompt generator.
 *
 * Returns instructions for Claude Code to invoke the start_meeting MCP tool
 * with the given topic. This is a prompt generator, not a standalone script.
 */

export function getMeetingSkillPrompt(args?: string): string {
  const topic = args?.trim();

  if (!topic) {
    return [
      '<command-name>meeting</command-name>',
      '',
      '## Meeting Skill',
      '',
      'Start an Open-Coleslaw multi-agent meeting.',
      '',
      'No topic was provided. Ask the user what they would like to discuss,',
      'then invoke the `start_meeting` tool with:',
      '',
      '- **topic**: A concise title for the meeting',
      '- **agenda**: An array of specific agenda items to discuss',
      '- **departments** (optional): Specific departments to invite.',
      '  If omitted, departments are auto-selected from the topic/agenda.',
      '',
      'Example:',
      '```json',
      '{',
      '  "topic": "Add user authentication",',
      '  "agenda": [',
      '    "Choose auth strategy (JWT vs session)",',
      '    "Design login/signup API endpoints",',
      '    "Plan database schema for users table"',
      '  ]',
      '}',
      '```',
    ].join('\n');
  }

  return [
    '<command-name>meeting</command-name>',
    '',
    '## Meeting Skill',
    '',
    `The user wants to start a meeting about: **${topic}**`,
    '',
    'Steps:',
    '1. Break the topic into 2-5 specific agenda items',
    '2. Invoke the `start_meeting` MCP tool with:',
    `   - **topic**: "${topic}"`,
    '   - **agenda**: the agenda items you identified',
    '   - **departments**: auto-select based on the topic (omit to let the orchestrator decide)',
    '',
    'After the meeting starts, report the meeting ID and the selected departments to the user.',
    '',
    'Important:',
    '- The orchestrator is the user\'s proxy/delegate, NOT the CEO',
    '- If any decision requires user input, it will surface as an @mention',
    '- Meeting minutes will be saved automatically in PRD format',
  ].join('\n');
}
