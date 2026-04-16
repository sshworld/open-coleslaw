import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';
import type { MentionRecord, MentionUrgency, MentionStatus, MentionOption } from '../types/index.js';

interface MentionRow {
  id: string;
  meeting_id: string;
  agenda_item: string | null;
  summary: string;
  options: string;
  urgency: string;
  status: string;
  user_decision: string | null;
  user_reasoning: string | null;
  created_at: number;
  resolved_at: number | null;
}

function rowToMention(row: MentionRow): MentionRecord {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    agendaItem: row.agenda_item,
    summary: row.summary,
    options: JSON.parse(row.options) as MentionOption[],
    urgency: row.urgency as MentionUrgency,
    status: row.status as MentionStatus,
    userDecision: row.user_decision,
    userReasoning: row.user_reasoning,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export function createMention(
  mention: Omit<MentionRecord, 'id' | 'status' | 'createdAt' | 'resolvedAt'> & {
    id?: string;
    status?: MentionStatus;
    createdAt?: number;
    resolvedAt?: number | null;
  }
): MentionRecord {
  const db = getDb();
  const id = mention.id ?? uuidv4();
  const status = mention.status ?? 'pending';
  const createdAt = mention.createdAt ?? Date.now();
  const resolvedAt = mention.resolvedAt ?? null;

  db.prepare(
    `INSERT INTO mentions (id, meeting_id, agenda_item, summary, options, urgency, status, user_decision, user_reasoning, created_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    mention.meetingId,
    mention.agendaItem,
    mention.summary,
    JSON.stringify(mention.options),
    mention.urgency,
    status,
    mention.userDecision,
    mention.userReasoning,
    createdAt,
    resolvedAt
  );

  return {
    id,
    meetingId: mention.meetingId,
    agendaItem: mention.agendaItem,
    summary: mention.summary,
    options: mention.options,
    urgency: mention.urgency,
    status,
    userDecision: mention.userDecision,
    userReasoning: mention.userReasoning,
    createdAt,
    resolvedAt,
  };
}

export function getMention(id: string): MentionRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM mentions WHERE id = ?').get(id) as MentionRow | undefined;
  return row ? rowToMention(row) : null;
}

export function updateMention(
  id: string,
  updates: Partial<Omit<MentionRecord, 'id'>>
): MentionRecord | null {
  const db = getDb();
  const existing = getMention(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.meetingId !== undefined) { fields.push('meeting_id = ?'); values.push(updates.meetingId); }
  if (updates.agendaItem !== undefined) { fields.push('agenda_item = ?'); values.push(updates.agendaItem); }
  if (updates.summary !== undefined) { fields.push('summary = ?'); values.push(updates.summary); }
  if (updates.options !== undefined) { fields.push('options = ?'); values.push(JSON.stringify(updates.options)); }
  if (updates.urgency !== undefined) { fields.push('urgency = ?'); values.push(updates.urgency); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.userDecision !== undefined) { fields.push('user_decision = ?'); values.push(updates.userDecision); }
  if (updates.userReasoning !== undefined) { fields.push('user_reasoning = ?'); values.push(updates.userReasoning); }
  if (updates.createdAt !== undefined) { fields.push('created_at = ?'); values.push(updates.createdAt); }
  if (updates.resolvedAt !== undefined) { fields.push('resolved_at = ?'); values.push(updates.resolvedAt); }

  if (fields.length === 0) return existing;

  values.push(id);
  db.prepare(`UPDATE mentions SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getMention(id);
}

export function listPendingMentions(): MentionRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM mentions WHERE status = 'pending' ORDER BY created_at ASC")
    .all() as MentionRow[];
  return rows.map(rowToMention);
}

export function listMentionsByMeeting(meetingId: string): MentionRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM mentions WHERE meeting_id = ? ORDER BY created_at ASC')
    .all(meetingId) as MentionRow[];
  return rows.map(rowToMention);
}
