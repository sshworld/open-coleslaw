/**
 * /minutes skill — prompt generator.
 *
 * If args has a meetingId, retrieve that specific meeting's minutes.
 * Otherwise, list recent meetings and their minutes.
 */

export function getMinutesSkillPrompt(args?: string): string {
  const meetingId = args?.trim();

  if (meetingId) {
    return [
      '<command-name>minutes</command-name>',
      '',
      '## Minutes Skill',
      '',
      `Retrieve minutes for meeting: **${meetingId}**`,
      '',
      'Steps:',
      '1. Invoke the `get-minutes` MCP tool with:',
      `   - **meetingId**: "${meetingId}"`,
      '   - **format**: "full"',
      '2. Display the minutes content in a readable format',
      '3. Highlight key sections:',
      '   - **Executive Summary**',
      '   - **Decisions** made during the meeting',
      '   - **Action Items** with owners and priorities',
      '   - **Open Questions** that still need resolution',
      '   - **Next Steps**',
      '',
      'If the minutes are in PRD format, preserve the structure.',
      'If no minutes exist for this meeting, report that and suggest',
      'the user check the meeting status — minutes are generated',
      'when a meeting completes.',
    ].join('\n');
  }

  return [
    '<command-name>minutes</command-name>',
    '',
    '## Minutes Skill',
    '',
    'List recent meeting minutes.',
    '',
    'Steps:',
    '1. Invoke the `get-meeting-status` MCP tool to list recent meetings',
    '2. For each completed meeting, invoke `get-minutes` with format "summary"',
    '3. Display a table of recent meetings:',
    '',
    '| Date | Topic | Status | Action Items |',
    '|------|-------|--------|-------------|',
    '| 2026-04-15 | Auth System Design | completed | 5 items |',
    '',
    '4. Ask the user if they want to view the full minutes for any meeting',
    '',
    'If no meetings have been held, report that and suggest starting',
    'a meeting with `/meeting <topic>`.',
    '',
    'Minutes files are also stored as markdown in `~/.open-coleslaw/minutes/`.',
    'The user can browse them directly if preferred.',
  ].join('\n');
}
