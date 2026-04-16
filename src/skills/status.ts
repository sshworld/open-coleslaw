/**
 * /status skill — prompt generator.
 *
 * Returns instructions for Claude Code to display the current orchestrator
 * status including active meetings, agents, and pending mentions.
 */

export function getStatusSkillPrompt(args?: string): string {
  const meetingId = args?.trim();

  if (meetingId) {
    return [
      '<command-name>status</command-name>',
      '',
      '## Status Skill',
      '',
      `Show the status for meeting: **${meetingId}**`,
      '',
      'Use the Open-Coleslaw MCP tools to retrieve:',
      '1. Meeting details (topic, phase, participants, status)',
      '2. Active agents and their current tasks',
      '3. Any pending @mentions that need user input',
      '4. Meeting minutes if the meeting is completed',
      '',
      'Format the output as a clean summary with sections for each.',
    ].join('\n');
  }

  return [
    '<command-name>status</command-name>',
    '',
    '## Status Skill',
    '',
    'Show the full Open-Coleslaw orchestrator status.',
    '',
    'Retrieve and display:',
    '',
    '### Active Meetings',
    'List all meetings that are not completed/cancelled/failed.',
    'For each, show: meeting ID, topic, current phase, participant count.',
    '',
    '### Agent Hierarchy',
    'Show the current agent tree:',
    '- Orchestrator (root)',
    '  - Leaders (by department)',
    '    - Workers (by task)',
    '',
    '### Pending @mentions',
    'List any @mentions waiting for user response.',
    'For each, show: summary, urgency (blocking/advisory), options.',
    '',
    '### Cost Summary',
    'Show total cost across all active agents.',
    '',
    'If nothing is active, report that the system is idle.',
  ].join('\n');
}
