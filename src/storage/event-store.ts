import { getDb } from './db.js';

interface EventRow {
  id: number;
  event_type: string;
  payload: string;
  created_at: number;
}

export interface StoredEvent {
  id: number;
  eventType: string;
  payload: unknown;
  createdAt: number;
}

function rowToEvent(row: EventRow): StoredEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    payload: JSON.parse(row.payload) as unknown,
    createdAt: row.created_at,
  };
}

export function insertEvent(eventType: string, payload: unknown): StoredEvent {
  const db = getDb();
  const createdAt = Date.now();
  const payloadStr = JSON.stringify(payload);

  const result = db
    .prepare(
      'INSERT INTO events (event_type, payload, created_at) VALUES (?, ?, ?)'
    )
    .run(eventType, payloadStr, createdAt);

  return {
    id: Number(result.lastInsertRowid),
    eventType,
    payload,
    createdAt,
  };
}

export function listEvents(options?: {
  type?: string;
  limit?: number;
}): StoredEvent[] {
  const db = getDb();
  const type = options?.type;
  const limit = options?.limit ?? 100;

  let rows: EventRow[];

  if (type) {
    rows = db
      .prepare(
        'SELECT * FROM events WHERE event_type = ? ORDER BY created_at DESC LIMIT ?'
      )
      .all(type, limit) as EventRow[];
  } else {
    rows = db
      .prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT ?')
      .all(limit) as EventRow[];
  }

  return rows.map(rowToEvent);
}
