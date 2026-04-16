import { randomUUID } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { ensureDataDirs } from './utils/config.js';
import { startDashboard } from './dashboard/server.js';

async function main() {
  ensureDataDirs();
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Start dashboard alongside MCP server
  const sessionId = randomUUID();
  const projectPath = process.cwd();
  const projectName = projectPath.split('/').pop() ?? 'unknown';

  await startDashboard({ sessionId, projectPath, projectName });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
