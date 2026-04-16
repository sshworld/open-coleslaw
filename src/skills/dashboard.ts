/**
 * /dashboard skill — prompt generator.
 *
 * Returns instructions for Claude Code to output the dashboard URL
 * and optionally open it.
 */

import { getConfig } from '../utils/config.js';

export function getDashboardSkillPrompt(_args?: string): string {
  const config = getConfig();
  const url = `http://localhost:${config.DASHBOARD_PORT}`;

  return [
    '<command-name>dashboard</command-name>',
    '',
    '## Dashboard Skill',
    '',
    `The Open-Coleslaw web dashboard is available at: **${url}**`,
    '',
    'The dashboard shows a real-time visualization of:',
    '- Agent hierarchy (orchestrator → leaders → workers)',
    '- Meeting phases and progress',
    '- @mention notifications',
    '- Cost tracking per agent',
    '- Live event stream',
    '',
    `Tell the user the dashboard URL is: ${url}`,
    '',
    'If the user wants to open it, run:',
    '```bash',
    `open ${url}`,
    '```',
    '',
    'Note: The dashboard requires the MCP server to be running.',
    'The WebSocket server starts automatically with the plugin.',
  ].join('\n');
}
