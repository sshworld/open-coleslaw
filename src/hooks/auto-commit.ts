/**
 * auto-commit hook — standalone script.
 *
 * Checks the current git state and, if there are staged or unstaged changes,
 * generates a conventional commit message based on the changed files.
 *
 * Output (JSON to stdout):
 *   {
 *     "hasChanges": boolean,
 *     "staged": string[],
 *     "unstaged": string[],
 *     "suggestedType": "feat" | "fix" | "docs" | "refactor" | "test" | "chore",
 *     "suggestedMessage": string,
 *     "command": string          // the full `git commit` command to run
 *   }
 *
 * If git is not initialized or there are no changes, outputs:
 *   { "hasChanges": false, "reason": "..." }
 *
 * Usage:
 *   node dist/hooks/auto-commit.js [cwd]
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function exec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function isGitRepo(cwd: string): boolean {
  const result = exec('git rev-parse --is-inside-work-tree', cwd);
  return result === 'true';
}

function getStagedFiles(cwd: string): string[] {
  const output = exec('git diff --cached --name-only', cwd);
  return output ? output.split('\n').filter(Boolean) : [];
}

function getUnstagedFiles(cwd: string): string[] {
  const output = exec('git diff --name-only', cwd);
  return output ? output.split('\n').filter(Boolean) : [];
}

function getUntrackedFiles(cwd: string): string[] {
  const output = exec('git ls-files --others --exclude-standard', cwd);
  return output ? output.split('\n').filter(Boolean) : [];
}

// ---------------------------------------------------------------------------
// Commit type inference
// ---------------------------------------------------------------------------

type ConventionalType = 'feat' | 'fix' | 'docs' | 'refactor' | 'test' | 'chore';

function inferCommitType(files: string[]): ConventionalType {
  const allPaths = files.join(' ').toLowerCase();

  // Test files
  if (files.every((f) => f.includes('test') || f.includes('spec') || f.includes('__tests__'))) {
    return 'test';
  }

  // Docs
  if (
    files.every(
      (f) =>
        f.endsWith('.md') ||
        f.endsWith('.txt') ||
        f.endsWith('.rst') ||
        f.includes('docs/') ||
        f.includes('doc/'),
    )
  ) {
    return 'docs';
  }

  // Fix: filenames or paths that suggest a fix
  if (allPaths.includes('fix') || allPaths.includes('patch') || allPaths.includes('hotfix')) {
    return 'fix';
  }

  // Chore: config / build / CI
  if (
    files.every(
      (f) =>
        f.includes('config') ||
        f.includes('.json') ||
        f.includes('.yaml') ||
        f.includes('.yml') ||
        f.includes('ci/') ||
        f.includes('.github/') ||
        f.includes('Makefile') ||
        f.includes('Dockerfile'),
    )
  ) {
    return 'chore';
  }

  // Refactor: if all files already exist (no new files)
  // We can't easily tell from filenames alone, so default to feat for new additions
  if (allPaths.includes('refactor')) {
    return 'refactor';
  }

  return 'feat';
}

function inferScope(files: string[]): string | null {
  // Try to find a common directory
  const dirs = files
    .map((f) => {
      const parts = f.split('/');
      return parts.length > 1 ? parts[parts.length - 2] : null;
    })
    .filter((d): d is string => d !== null);

  if (dirs.length === 0) return null;

  // If all in same directory, use that as scope
  const unique = [...new Set(dirs)];
  if (unique.length === 1) return unique[0];

  // If there's a dominant directory (>= 50% of files), use it
  const counts = new Map<string, number>();
  for (const d of dirs) {
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted[0] && sorted[0][1] >= dirs.length * 0.5) {
    return sorted[0][0];
  }

  return null;
}

function buildMessage(type: ConventionalType, scope: string | null, files: string[]): string {
  const scopePart = scope ? `(${scope})` : '';
  const fileCount = files.length;

  let description: string;
  if (fileCount === 1) {
    const fileName = files[0].split('/').pop() ?? files[0];
    description = `update ${fileName}`;
  } else {
    description = `update ${fileCount} files`;
  }

  return `${type}${scopePart}: ${description}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const cwd = process.argv[2] ? resolve(process.argv[2]) : process.cwd();

  // Check git
  if (!isGitRepo(cwd)) {
    process.stdout.write(
      JSON.stringify({ hasChanges: false, reason: 'Not a git repository' }, null, 2) + '\n',
    );
    return;
  }

  const staged = getStagedFiles(cwd);
  const unstaged = getUnstagedFiles(cwd);
  const untracked = getUntrackedFiles(cwd);

  const allChanged = [...staged, ...unstaged, ...untracked];

  if (allChanged.length === 0) {
    process.stdout.write(
      JSON.stringify({ hasChanges: false, reason: 'No changes detected' }, null, 2) + '\n',
    );
    return;
  }

  const type = inferCommitType(allChanged);
  const scope = inferScope(allChanged);
  const suggestedMessage = buildMessage(type, scope, allChanged);

  // Build the git command — stage everything first, then commit
  const stageCmd = 'git add -A';
  const commitCmd = `git commit -m "${suggestedMessage}"`;
  const command = `${stageCmd} && ${commitCmd}`;

  const result = {
    hasChanges: true,
    staged,
    unstaged,
    untracked,
    suggestedType: type,
    suggestedMessage,
    command,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main();
