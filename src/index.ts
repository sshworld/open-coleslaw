import { randomUUID } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { ensureDataDirs } from './utils/config.js';
import { startDashboard } from './dashboard/server.js';
import { logger } from './utils/logger.js';

async function main() {
  ensureDataDirs();

  // Only start dashboard if not explicitly disabled
  const isBareSubprocess = process.env['CLAUDE_CODE_SIMPLE'] === '1';

  if (!isBareSubprocess) {
    const sessionId = randomUUID();
    const projectPath = process.cwd();
    const projectName = projectPath.split('/').pop() ?? 'unknown';
    startDashboard({ sessionId, projectPath, projectName }).catch((err: unknown) => {
      logger.warn(
        `Dashboard startup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  // stderr, not stdout — stdout is the MCP JSON-RPC channel.
  logger.error(
    `Fatal error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
