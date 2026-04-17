/**
 * Rehydrate past meeting summaries from the per-project `docs/open-coleslaw/`
 * directory.
 *
 * The StateBridge lives in memory, so when the MCP server restarts (new Claude
 * Code session) the `pastMeetings` array starts empty and the dashboard
 * sidebar loses its history. The markdown files on disk are the real source
 * of truth; this module parses them into `MeetingThread` stubs with enough
 * data to show in the sidebar and, when clicked, render a summary view.
 *
 * Full round-by-round dialog is NOT rehydrated (that would require reading
 * SQLite transcripts and parsing the markdown Discussion sections); we
 * populate decisions and action items, which is what the sidebar and thread
 * summary actually need. Good enough.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MeetingThread, MeetingType } from '../types/dashboard-events.js';
import { logger } from '../utils/logger.js';

const MINUTES_DIR = 'docs/open-coleslaw';

/**
 * Scan the project's minutes directory and return parsed past meetings,
 * newest first. Returns [] if the directory doesn't exist or has no minutes.
 */
export async function hydratePastMeetings(
  projectPath: string,
  limit = 20,
): Promise<MeetingThread[]> {
  const dir = join(projectPath, MINUTES_DIR);

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  // Include only meeting markdown files. Exclude INDEX.md, dotfiles, consumed logs.
  const minutesFiles = files
    .filter((f) => f.endsWith('.md'))
    .filter((f) => f !== 'INDEX.md')
    .filter((f) => !f.startsWith('.'))
    .sort()
    .reverse(); // newest first by lexical sort on YYYY-MM-DD prefix

  const threads: MeetingThread[] = [];
  for (const filename of minutesFiles) {
    if (threads.length >= limit) break;
    try {
      const content = await readFile(join(dir, filename), 'utf-8');
      const parsed = parseMinutesMarkdown(filename, content);
      if (parsed) threads.push(parsed);
    } catch (err) {
      logger.warn(
        `minutes-hydrator: failed to parse ${filename}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return threads;
}

/**
 * Best-effort parser: extracts topic, meetingId, date, type, participants,
 * decisions, action items from a markdown minutes file.
 *
 * We never throw — if a field is missing we fall back to a sensible default
 * so the dashboard always gets *something* to show.
 */
function parseMinutesMarkdown(filename: string, md: string): MeetingThread | null {
  const topic =
    grabField(md, 'Topic') ||
    firstH1(md) ||
    filename.replace(/\.md$/, '');

  const meetingId =
    grabField(md, 'MeetingId') ||
    grabField(md, 'meetingId') ||
    `hydrated:${filename}`;

  const date = grabField(md, 'Date') || inferDateFromFilename(filename) || '';
  const type = inferTypeFromFilename(filename);
  const participants = parseParticipants(md);
  const decisions = extractBulletedSection(md, 'Decisions');
  const actionItems = extractBulletedSection(md, 'Action Items');
  const agenda = extractNumberedSection(md, 'Agenda');

  const startedAt = date ? Date.parse(date) || Date.now() : Date.now();

  return {
    meetingId,
    meetingType: type,
    topic,
    agenda,
    participants,
    status: 'completed',
    phase: 'minutes-generation',
    comments: [],
    mvps: [],
    decisions,
    actionItems,
    startedAt,
    completedAt: startedAt,
  };
}

// ----- field grabbers -----

function grabField(md: string, name: string): string | null {
  // matches "- **Name:** value" or "- Name: value" or "**Name:** value".
  // Bold markers can appear before the colon (`**Name:**`) or around the name
  // only (`**Name**:`), and the value may be wrapped in its own bold markers.
  const re = new RegExp(
    `^\\s*-?\\s*\\*{0,2}\\s*${escapeRegex(name)}\\s*\\*{0,2}\\s*:\\s*\\*{0,2}\\s*(.+?)\\s*\\*{0,2}\\s*$`,
    'im',
  );
  const m = md.match(re);
  if (!m) return null;
  // Strip any lingering asterisk wrapping the captured value.
  return m[1].replace(/^\**/, '').replace(/\**$/, '').trim();
}

function firstH1(md: string): string | null {
  const m = md.match(/^#\s+(.+)$/m);
  if (!m) return null;
  // Strip leading "Meeting Minutes —" prefix for clean display
  return m[1].replace(/^Meeting Minutes\s*[—-]\s*/i, '').trim();
}

function parseParticipants(md: string): string[] {
  const field = grabField(md, 'Participants');
  if (!field) return [];
  return field
    .replace(/\*+/g, '')
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extracts bullet points under a `## <heading>` section until the next heading.
 * Handles `- item`, `* item`, `- [ ] item`, `- [x] item`.
 */
function extractBulletedSection(md: string, heading: string): string[] {
  const lines = md.split('\n');
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    const h = line.match(/^#{2,3}\s+(.+)$/);
    if (h) {
      inSection = h[1].trim().toLowerCase().startsWith(heading.toLowerCase());
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^\s*[-*]\s+(?:\[[ xX]\]\s+)?(.*\S)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

/**
 * Extracts numbered list items under a `## Agenda` section.
 */
function extractNumberedSection(md: string, heading: string): string[] {
  const lines = md.split('\n');
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    const h = line.match(/^#{2,3}\s+(.+)$/);
    if (h) {
      inSection = h[1].trim().toLowerCase().startsWith(heading.toLowerCase());
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^\s*\d+\.\s+(.+\S)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

function inferTypeFromFilename(filename: string): MeetingType {
  if (filename.includes('_kickoff_')) return 'kickoff';
  if (filename.includes('_verify-retry_') || filename.includes('-verify-retry')) return 'verify-retry';
  return 'design';
}

function inferDateFromFilename(filename: string): string | null {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})_/);
  return m ? m[1] : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
