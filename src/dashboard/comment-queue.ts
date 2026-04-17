/**
 * Browser comment queue — file-based IPC between the dashboard server and an
 * orchestrator agent running inside a Claude Code session.
 *
 * The orchestrator cannot accept WebSocket messages directly (MCP has no
 * server→session push), so the dashboard appends a user's comment to a JSONL
 * file inside the target project's `docs/open-coleslaw/` directory. The
 * orchestrator reads and rotates this file at round boundaries.
 *
 *  ${projectPath}/docs/open-coleslaw/.pending-comments.jsonl          — unread
 *  ${projectPath}/docs/open-coleslaw/.pending-comments.consumed.jsonl — archive
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface PendingComment {
  meetingId: string;
  content: string;
  createdAt: number;
  source: 'browser';
}

const DIR = 'docs/open-coleslaw';
const PENDING = '.pending-comments.jsonl';

export async function enqueueComment(
  projectPath: string,
  entry: PendingComment,
): Promise<void> {
  const dir = join(projectPath, DIR);
  await mkdir(dir, { recursive: true });
  const file = join(dir, PENDING);
  const line = JSON.stringify(entry) + '\n';
  await appendFile(file, line, 'utf8');
}

export function pendingCommentFile(projectPath: string): string {
  return join(projectPath, DIR, PENDING);
}
