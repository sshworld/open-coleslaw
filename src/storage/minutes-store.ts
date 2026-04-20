import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';
import type { MinutesRecord, MinutesFormat, ActionItem } from '../types/index.js';

interface MinutesRow {
  id: string;
  meeting_id: string;
  format: string;
  content: string;
  action_items: string;
  created_at: number;
}

function rowToMinutes(row: MinutesRow): MinutesRecord {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    format: row.format as MinutesFormat,
    content: row.content,
    actionItems: JSON.parse(row.action_items) as ActionItem[],
    createdAt: row.created_at,
  };
}

export function createMinutes(
  minutes: Omit<MinutesRecord, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: number;
  }
): MinutesRecord {
  const db = getDb();
  const id = minutes.id ?? uuidv4();
  const createdAt = minutes.createdAt ?? Date.now();

  db.prepare(
    `INSERT INTO minutes (id, meeting_id, format, content, action_items, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    minutes.meetingId,
    minutes.format,
    minutes.content,
    JSON.stringify(minutes.actionItems),
    createdAt
  );

  return {
    id,
    meetingId: minutes.meetingId,
    format: minutes.format,
    content: minutes.content,
    actionItems: minutes.actionItems,
    createdAt,
  };
}

export function getMinutesByMeeting(meetingId: string): MinutesRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM minutes WHERE meeting_id = ?')
    .get(meetingId) as MinutesRow | undefined;
  return row ? rowToMinutes(row) : null;
}

/**
 * Update an existing minutes row in place. Used when a follow-up discussion
 * round extends the meeting after the initial minutes were finalised — we
 * append the new content and refresh the action items without losing the
 * original decisions.
 */
export function updateMinutes(
  meetingId: string,
  updates: Partial<{ content: string; actionItems: ActionItem[] }>,
): MinutesRecord | null {
  const db = getDb();
  const existing = getMinutesByMeeting(meetingId);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];
  if (updates.content !== undefined) {
    fields.push('content = ?');
    values.push(updates.content);
  }
  if (updates.actionItems !== undefined) {
    fields.push('action_items = ?');
    values.push(JSON.stringify(updates.actionItems));
  }
  if (fields.length === 0) return existing;
  values.push(meetingId);
  db.prepare(`UPDATE minutes SET ${fields.join(', ')} WHERE meeting_id = ?`).run(...values);
  return getMinutesByMeeting(meetingId);
}
