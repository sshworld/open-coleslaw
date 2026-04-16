import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';
import type { Meeting, MeetingStatus, MeetingPhase } from '../types/index.js';

interface MeetingRow {
  id: string;
  topic: string;
  agenda: string;
  participant_ids: string;
  status: string;
  phase: string;
  started_at: number | null;
  completed_at: number | null;
  initiated_by: string;
  previous_meeting_id?: string | null;
}

/** Ensure the previous_meeting_id column exists (backward-compat migration). */
function ensurePreviousMeetingIdColumn(): void {
  const db = getDb();
  // PRAGMA table_info returns rows for each column; check if the column exists.
  const cols = db.prepare("PRAGMA table_info('meetings')").all() as Array<{ name: string }>;
  const hasColumn = cols.some((c) => c.name === 'previous_meeting_id');
  if (!hasColumn) {
    db.exec('ALTER TABLE meetings ADD COLUMN previous_meeting_id TEXT DEFAULT NULL');
  }
}

let columnChecked = false;

function rowToMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    topic: row.topic,
    agenda: JSON.parse(row.agenda) as string[],
    participantIds: JSON.parse(row.participant_ids) as string[],
    status: row.status as MeetingStatus,
    phase: row.phase as MeetingPhase,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    initiatedBy: row.initiated_by,
    previousMeetingId: row.previous_meeting_id ?? null,
  };
}

export function createMeeting(
  meeting: Omit<Meeting, 'id' | 'status' | 'phase' | 'startedAt' | 'completedAt' | 'previousMeetingId'> & {
    id?: string;
    status?: MeetingStatus;
    phase?: MeetingPhase;
    startedAt?: number | null;
    completedAt?: number | null;
    previousMeetingId?: string | null;
  }
): Meeting {
  if (!columnChecked) {
    ensurePreviousMeetingIdColumn();
    columnChecked = true;
  }

  const db = getDb();
  const id = meeting.id ?? uuidv4();
  const status = meeting.status ?? 'pending';
  const phase = meeting.phase ?? 'orchestrator-phase';
  const startedAt = meeting.startedAt ?? null;
  const completedAt = meeting.completedAt ?? null;
  const previousMeetingId = meeting.previousMeetingId ?? null;

  db.prepare(
    `INSERT INTO meetings (id, topic, agenda, participant_ids, status, phase, started_at, completed_at, initiated_by, previous_meeting_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    meeting.topic,
    JSON.stringify(meeting.agenda),
    JSON.stringify(meeting.participantIds),
    status,
    phase,
    startedAt,
    completedAt,
    meeting.initiatedBy,
    previousMeetingId
  );

  return {
    id,
    topic: meeting.topic,
    agenda: meeting.agenda,
    participantIds: meeting.participantIds,
    status,
    phase,
    startedAt,
    completedAt,
    initiatedBy: meeting.initiatedBy,
    previousMeetingId,
  };
}

export function getMeeting(id: string): Meeting | null {
  if (!columnChecked) {
    ensurePreviousMeetingIdColumn();
    columnChecked = true;
  }

  const db = getDb();
  const row = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as MeetingRow | undefined;
  return row ? rowToMeeting(row) : null;
}

export function updateMeeting(
  id: string,
  updates: Partial<Omit<Meeting, 'id'>>
): Meeting | null {
  const db = getDb();
  const existing = getMeeting(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.topic !== undefined) { fields.push('topic = ?'); values.push(updates.topic); }
  if (updates.agenda !== undefined) { fields.push('agenda = ?'); values.push(JSON.stringify(updates.agenda)); }
  if (updates.participantIds !== undefined) { fields.push('participant_ids = ?'); values.push(JSON.stringify(updates.participantIds)); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.phase !== undefined) { fields.push('phase = ?'); values.push(updates.phase); }
  if (updates.startedAt !== undefined) { fields.push('started_at = ?'); values.push(updates.startedAt); }
  if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(updates.completedAt); }
  if (updates.initiatedBy !== undefined) { fields.push('initiated_by = ?'); values.push(updates.initiatedBy); }
  if (updates.previousMeetingId !== undefined) { fields.push('previous_meeting_id = ?'); values.push(updates.previousMeetingId); }

  if (fields.length === 0) return existing;

  values.push(id);
  db.prepare(`UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getMeeting(id);
}

export function listMeetings(statusFilter?: MeetingStatus): Meeting[] {
  if (!columnChecked) {
    ensurePreviousMeetingIdColumn();
    columnChecked = true;
  }

  const db = getDb();
  let rows: MeetingRow[];

  if (statusFilter) {
    rows = db
      .prepare('SELECT * FROM meetings WHERE status = ? ORDER BY started_at DESC')
      .all(statusFilter) as MeetingRow[];
  } else {
    rows = db
      .prepare('SELECT * FROM meetings ORDER BY started_at DESC')
      .all() as MeetingRow[];
  }

  return rows.map(rowToMeeting);
}
