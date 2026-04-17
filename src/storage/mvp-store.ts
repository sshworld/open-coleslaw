import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';

export type MvpStatus = 'pending' | 'in-progress' | 'done' | 'blocked';

export interface MvpRecord {
  id: string;
  kickoffMeetingId: string;
  title: string;
  goal: string;
  status: MvpStatus;
  orderIndex: number;
  designMeetingId: string | null;
  createdAt: number;
  completedAt: number | null;
}

interface MvpRow {
  id: string;
  kickoff_meeting_id: string;
  title: string;
  goal: string;
  status: string;
  order_index: number;
  design_meeting_id: string | null;
  created_at: number;
  completed_at: number | null;
}

function rowToMvp(row: MvpRow): MvpRecord {
  return {
    id: row.id,
    kickoffMeetingId: row.kickoff_meeting_id,
    title: row.title,
    goal: row.goal,
    status: row.status as MvpStatus,
    orderIndex: row.order_index,
    designMeetingId: row.design_meeting_id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function createMvp(
  input: Omit<MvpRecord, 'id' | 'createdAt' | 'completedAt' | 'designMeetingId' | 'status'> & {
    id?: string;
    status?: MvpStatus;
  }
): MvpRecord {
  const db = getDb();
  const id = input.id ?? uuidv4();
  const createdAt = Date.now();
  const status: MvpStatus = input.status ?? 'pending';

  db.prepare(
    `INSERT INTO mvps (id, kickoff_meeting_id, title, goal, status, order_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.kickoffMeetingId, input.title, input.goal, status, input.orderIndex, createdAt);

  return {
    id,
    kickoffMeetingId: input.kickoffMeetingId,
    title: input.title,
    goal: input.goal,
    status,
    orderIndex: input.orderIndex,
    designMeetingId: null,
    createdAt,
    completedAt: null,
  };
}

export function getMvp(id: string): MvpRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM mvps WHERE id = ?').get(id) as MvpRow | undefined;
  return row ? rowToMvp(row) : null;
}

export function listMvpsByKickoff(kickoffMeetingId: string): MvpRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM mvps WHERE kickoff_meeting_id = ? ORDER BY order_index ASC')
    .all(kickoffMeetingId) as MvpRow[];
  return rows.map(rowToMvp);
}

export function listPendingMvps(): MvpRecord[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM mvps WHERE status IN ('pending', 'in-progress') ORDER BY order_index ASC`)
    .all() as MvpRow[];
  return rows.map(rowToMvp);
}

export function updateMvp(
  id: string,
  updates: Partial<{
    status: MvpStatus;
    designMeetingId: string | null;
    completedAt: number | null;
  }>
): MvpRecord | null {
  const db = getDb();
  const current = getMvp(id);
  if (!current) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.designMeetingId !== undefined) {
    fields.push('design_meeting_id = ?');
    values.push(updates.designMeetingId);
  }
  if (updates.completedAt !== undefined) {
    fields.push('completed_at = ?');
    values.push(updates.completedAt);
  }

  if (fields.length === 0) return current;

  values.push(id);
  db.prepare(`UPDATE mvps SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getMvp(id);
}
