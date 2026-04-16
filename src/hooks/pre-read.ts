/**
 * pre-read hook — standalone script.
 *
 * Loads rules.md, plugin-guide.md, and project CLAUDE.md/README.md
 * before every execution. Outputs combined context to stdout so the
 * hook runner can inject the text into the conversation.
 *
 * Missing files are silently skipped.
 *
 * Usage:
 *   node dist/hooks/pre-read.js [cwd]
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryReadFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function section(title: string, content: string): string {
  return `\n<!-- open-coleslaw: ${title} -->\n${content}\n<!-- /open-coleslaw: ${title} -->\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const dataDir = join(homedir(), '.open-coleslaw');
  const cwd = process.argv[2] ? resolve(process.argv[2]) : process.cwd();

  const parts: string[] = [];

  // 1. Rules
  const rules = tryReadFile(join(dataDir, 'rules.md'));
  if (rules) {
    parts.push(section('rules', rules));
  }

  // 2. Plugin guide
  const guide = tryReadFile(join(dataDir, 'plugin-guide.md'));
  if (guide) {
    parts.push(section('plugin-guide', guide));
  }

  // 3. Project CLAUDE.md (look in CWD)
  const claudeMd = tryReadFile(join(cwd, 'CLAUDE.md'));
  if (claudeMd) {
    parts.push(section('CLAUDE.md', claudeMd));
  }

  // 4. Project README.md (look in CWD)
  const readmeMd = tryReadFile(join(cwd, 'README.md'));
  if (readmeMd) {
    parts.push(section('README.md', readmeMd));
  }

  if (parts.length === 0) {
    // Nothing found — output an empty string, don't error
    process.stdout.write('');
    return;
  }

  process.stdout.write(parts.join('\n'));
}

main();
