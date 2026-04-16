/**
 * Meeting minutes file-system storage.
 *
 * Saves meeting minutes as markdown files with YAML frontmatter alongside
 * the SQLite storage. Files are stored in ~/.open-coleslaw/minutes/.
 *
 * Filename format: YYYY-MM-DD_NNN_slug-topic.md
 * Example: 2026-04-15_001_auth-system-design.md
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getConfig } from '../utils/config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a topic string into a URL-safe slug.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * Get today's date as YYYY-MM-DD.
 */
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Ensure the minutes directory exists.
 */
function ensureMinutesDir(): string {
  const config = getConfig();
  mkdirSync(config.MINUTES_DIR, { recursive: true });
  return config.MINUTES_DIR;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the next sequence number for today.
 *
 * Scans existing files that start with today's date prefix and returns
 * the next available sequence number.
 */
export function getNextSeqForToday(): number {
  const dir = ensureMinutesDir();
  const prefix = todayStr();

  let maxSeq = 0;
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith('.md') && file !== 'INDEX.md') {
        // Extract sequence: YYYY-MM-DD_NNN_...
        const match = file.match(/^\d{4}-\d{2}-\d{2}_(\d{3})_/);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    }
  } catch {
    // Directory might not exist yet
  }

  return maxSeq + 1;
}

/**
 * Save minutes as a markdown file with YAML frontmatter.
 *
 * @returns The absolute path to the saved file.
 */
export function saveMinutesToFile(
  meetingId: string,
  topic: string,
  participants: string[],
  content: string,
  tags?: string[],
  decisions?: string[],
): string {
  const dir = ensureMinutesDir();
  const date = todayStr();
  const seq = getNextSeqForToday();
  const slug = slugify(topic);
  const seqStr = String(seq).padStart(3, '0');
  const filename = `${date}_${seqStr}_${slug}.md`;
  const filePath = join(dir, filename);

  // Build YAML frontmatter
  const frontmatter = buildFrontmatter({
    id: meetingId,
    date,
    seq,
    topic,
    participants,
    status: 'completed',
    tags: tags ?? extractTags(content),
    decisions: decisions ?? [],
    related_meetings: [],
  });

  const fileContent = `---\n${frontmatter}---\n\n${content}\n`;
  writeFileSync(filePath, fileContent, 'utf-8');

  return filePath;
}

/**
 * Update the INDEX.md file with a new entry.
 *
 * INDEX.md is organized by date with one-line summaries.
 */
export function updateMinutesIndex(entry: {
  date: string;
  seq: number;
  topic: string;
  filename: string;
  participants: string[];
  decisions: string[];
}): void {
  const dir = ensureMinutesDir();
  const indexPath = join(dir, 'INDEX.md');

  let existing = '';
  try {
    existing = readFileSync(indexPath, 'utf-8');
  } catch {
    // File doesn't exist yet
  }

  const newLine = `| ${entry.date} | ${String(entry.seq).padStart(3, '0')} | [${entry.topic}](./${entry.filename}) | ${entry.participants.join(', ')} | ${entry.decisions.length} decisions |`;

  if (!existing.trim()) {
    // Create fresh INDEX.md
    const header = [
      '# Meeting Minutes Index',
      '',
      '| Date | Seq | Topic | Participants | Decisions |',
      '|------|-----|-------|-------------|-----------|',
    ].join('\n');

    writeFileSync(indexPath, `${header}\n${newLine}\n`, 'utf-8');
    return;
  }

  // Append to existing INDEX.md
  // Check if this entry already exists (by filename)
  if (existing.includes(entry.filename)) {
    // Already indexed — skip
    return;
  }

  writeFileSync(indexPath, existing.trimEnd() + '\n' + newLine + '\n', 'utf-8');
}

/**
 * Search minutes files by keyword.
 *
 * Performs simple string matching on file contents.
 *
 * @returns Array of matching files with the lines that matched.
 */
export function searchMinutes(keyword: string): { filename: string; matchedLines: string[] }[] {
  const dir = ensureMinutesDir();
  const results: { filename: string; matchedLines: string[] }[] = [];
  const lowerKeyword = keyword.toLowerCase();

  try {
    const files = readdirSync(dir).filter(
      (f) => f.endsWith('.md') && f !== 'INDEX.md',
    );

    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const matched = lines.filter((line) =>
          line.toLowerCase().includes(lowerKeyword),
        );

        if (matched.length > 0) {
          results.push({ filename: file, matchedLines: matched });
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Directory might not exist
  }

  return results;
}

/**
 * List minutes filenames that have a specific tag in their frontmatter.
 */
export function listMinutesByTag(tag: string): string[] {
  const dir = ensureMinutesDir();
  const matching: string[] = [];
  const lowerTag = tag.toLowerCase();

  try {
    const files = readdirSync(dir).filter(
      (f) => f.endsWith('.md') && f !== 'INDEX.md',
    );

    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        // Extract frontmatter tags
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
          const fm = fmMatch[1];
          // Look for tags line
          const tagsMatch = fm.match(/^tags:\s*\[(.*)\]/m);
          if (tagsMatch) {
            const tags = tagsMatch[1]
              .split(',')
              .map((t) => t.trim().replace(/['"]/g, '').toLowerCase());
            if (tags.includes(lowerTag)) {
              matching.push(file);
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Directory might not exist
  }

  return matching;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface FrontmatterData {
  id: string;
  date: string;
  seq: number;
  topic: string;
  participants: string[];
  status: string;
  tags: string[];
  decisions: string[];
  related_meetings: string[];
}

function buildFrontmatter(data: FrontmatterData): string {
  const lines: string[] = [];

  lines.push(`id: "${data.id}"`);
  lines.push(`date: "${data.date}"`);
  lines.push(`seq: ${data.seq}`);
  lines.push(`topic: "${escapeFmString(data.topic)}"`);
  lines.push(`participants: [${data.participants.map((p) => `"${escapeFmString(p)}"`).join(', ')}]`);
  lines.push(`status: "${data.status}"`);
  lines.push(`tags: [${data.tags.map((t) => `"${escapeFmString(t)}"`).join(', ')}]`);
  lines.push(`decisions: [${data.decisions.map((d) => `"${escapeFmString(d)}"`).join(', ')}]`);
  lines.push(`related_meetings: [${data.related_meetings.map((m) => `"${escapeFmString(m)}"`).join(', ')}]`);

  return lines.join('\n') + '\n';
}

function escapeFmString(s: string): string {
  return s.replace(/"/g, '\\"');
}

/**
 * Extract basic tags from content by looking for common technical keywords.
 */
function extractTags(content: string): string[] {
  const lower = content.toLowerCase();
  const tagCandidates = [
    'api', 'database', 'auth', 'authentication', 'frontend', 'backend',
    'design', 'testing', 'deployment', 'ci-cd', 'security', 'performance',
    'infrastructure', 'migration', 'architecture', 'ux', 'accessibility',
  ];

  return tagCandidates.filter((tag) => lower.includes(tag));
}
