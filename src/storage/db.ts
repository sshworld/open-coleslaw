import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DB_DIR = join(homedir(), '.open-coleslaw');
const DB_PATH = join(DB_DIR, 'data.db');

let db: DatabaseType | null = null;

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    tier TEXT NOT NULL CHECK(tier IN ('orchestrator', 'leader', 'worker')),
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    parent_id TEXT,
    meeting_id TEXT,
    status TEXT NOT NULL DEFAULT 'idle',
    current_task TEXT,
    session_id TEXT,
    spawned_at INTEGER NOT NULL,
    completed_at INTEGER,
    cost_usd REAL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    agenda TEXT NOT NULL,
    participant_ids TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    phase TEXT NOT NULL DEFAULT 'orchestrator-phase',
    started_at INTEGER,
    completed_at INTEGER,
    initiated_by TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS transcript_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id TEXT NOT NULL,
    speaker_id TEXT NOT NULL,
    speaker_role TEXT NOT NULL,
    agenda_item_index INTEGER,
    round_number INTEGER,
    content TEXT NOT NULL,
    token_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS minutes (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL UNIQUE,
    format TEXT NOT NULL DEFAULT 'prd',
    content TEXT NOT NULL,
    action_items TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    leader_id TEXT NOT NULL,
    meeting_id TEXT NOT NULL,
    task_description TEXT NOT NULL,
    task_type TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    input_context TEXT,
    output_result TEXT,
    error_message TEXT,
    dependencies TEXT NOT NULL DEFAULT '[]',
    spawned_at INTEGER NOT NULL,
    completed_at INTEGER,
    cost_usd REAL DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS mentions (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    agenda_item TEXT,
    summary TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '[]',
    urgency TEXT NOT NULL DEFAULT 'advisory',
    status TEXT NOT NULL DEFAULT 'pending',
    user_decision TEXT,
    user_reasoning TEXT,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS mvps (
    id TEXT PRIMARY KEY,
    kickoff_meeting_id TEXT NOT NULL,
    title TEXT NOT NULL,
    goal TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in-progress', 'done', 'blocked')),
    order_index INTEGER NOT NULL,
    design_meeting_id TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  )`,
];

function applyMigrations(database: DatabaseType): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const applied = new Set(
    database
      .prepare('SELECT id FROM _migrations')
      .all()
      .map((row) => (row as { id: number }).id)
  );

  const applyMigration = database.transaction(() => {
    for (let i = 0; i < MIGRATIONS.length; i++) {
      if (!applied.has(i)) {
        database.exec(MIGRATIONS[i]);
        database
          .prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)')
          .run(i, Date.now());
      }
    }
  });

  applyMigration();
}

export function getDb(): DatabaseType {
  if (db) {
    return db;
  }

  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  applyMigrations(db);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
