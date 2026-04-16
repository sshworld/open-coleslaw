/**
 * Plugin uninstaller — /plugin uninstall handler.
 *
 * Removes the Open-Coleslaw MCP server registration and optionally
 * purges all data from ~/.open-coleslaw/.
 */

import { rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATA_DIR = join(homedir(), '.open-coleslaw');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate total size of a directory recursively (in bytes).
 */
function dirSize(dirPath: string): number {
  if (!existsSync(dirPath)) return 0;

  let total = 0;
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += dirSize(fullPath);
    } else {
      try {
        total += statSync(fullPath).size;
      } catch {
        // Skip files we can't stat
      }
    }
  }

  return total;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Uninstall the Open-Coleslaw plugin.
 *
 * @param purge - If true, removes all data including minutes, database, and
 *                custom extensions. If false (default), only deregisters the
 *                MCP server and removes config files but preserves user data.
 */
export async function uninstallPlugin(purge?: boolean): Promise<string> {
  const steps: string[] = [];
  const warnings: string[] = [];

  const dataExists = existsSync(DATA_DIR);

  if (purge) {
    // Full purge: remove everything
    if (dataExists) {
      const size = dirSize(DATA_DIR);
      try {
        rmSync(DATA_DIR, { recursive: true, force: true });
        steps.push(`Removed data directory: ${DATA_DIR} (${formatBytes(size)})`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        warnings.push(`Failed to remove ${DATA_DIR}: ${msg}`);
      }
    } else {
      steps.push(`Data directory does not exist: ${DATA_DIR} — nothing to remove`);
    }
  } else {
    // Soft uninstall: remove only config files, preserve user data
    if (dataExists) {
      const configFiles = ['rules.md', 'plugin-guide.md'];
      for (const file of configFiles) {
        const filePath = join(DATA_DIR, file);
        if (existsSync(filePath)) {
          try {
            rmSync(filePath);
            steps.push(`Removed config file: ${file}`);
          } catch {
            warnings.push(`Failed to remove ${file}`);
          }
        }
      }

      steps.push('Preserved user data (minutes/, custom-*/ directories, data.db)');
      steps.push('Run with purge=true to remove all data');
    } else {
      steps.push('No data directory found — nothing to clean up');
    }
  }

  // MCP deregistration command
  const mcpCommand = 'claude mcp remove open-coleslaw';

  // Build summary
  const lines: string[] = [
    `# Open-Coleslaw Uninstall${purge ? ' (Full Purge)' : ''}`,
    '',
    '## Steps Performed',
    ...steps.map((s) => `- ${s}`),
    '',
  ];

  if (warnings.length > 0) {
    lines.push('## Warnings');
    lines.push(...warnings.map((w) => `- ${w}`));
    lines.push('');
  }

  lines.push(
    '## Deregister MCP Server',
    '',
    'Run the following command to remove the MCP server from Claude Code:',
    '',
    '```bash',
    mcpCommand,
    '```',
    '',
  );

  if (!purge) {
    lines.push(
      '## Preserved Data',
      '',
      'The following data was preserved:',
      `- ${join(DATA_DIR, 'minutes/')} — meeting minutes`,
      `- ${join(DATA_DIR, 'data.db')} — database`,
      `- ${join(DATA_DIR, 'custom-*/')} — custom extensions`,
      '',
      'To remove all data, run uninstall with purge=true.',
    );
  }

  return lines.join('\n');
}
