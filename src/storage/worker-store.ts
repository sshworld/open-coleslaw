import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';
import type { WorkerRecord, WorkerStatus, TaskType } from '../types/index.js';

interface WorkerRow {
  id: string;
  leader_id: string;
  meeting_id: string;
  task_description: string;
  task_type: string | null;
  status: string;
  input_context: string | null;
  output_result: string | null;
  error_message: string | null;
  dependencies: string;
  spawned_at: number;
  completed_at: number | null;
  cost_usd: number;
}

function rowToWorker(row: WorkerRow): WorkerRecord {
  return {
    id: row.id,
    leaderId: row.leader_id,
    meetingId: row.meeting_id,
    taskDescription: row.task_description,
    taskType: row.task_type as TaskType | null,
    status: row.status as WorkerStatus,
    inputContext: row.input_context,
    outputResult: row.output_result,
    errorMessage: row.error_message,
    dependencies: JSON.parse(row.dependencies) as string[],
    spawnedAt: row.spawned_at,
    completedAt: row.completed_at,
    costUsd: row.cost_usd,
  };
}

export function createWorker(
  worker: Omit<WorkerRecord, 'id' | 'status' | 'spawnedAt' | 'completedAt' | 'costUsd'> & {
    id?: string;
    status?: WorkerStatus;
    spawnedAt?: number;
    completedAt?: number | null;
    costUsd?: number;
  }
): WorkerRecord {
  const db = getDb();
  const id = worker.id ?? uuidv4();
  const status = worker.status ?? 'pending';
  const spawnedAt = worker.spawnedAt ?? Date.now();
  const completedAt = worker.completedAt ?? null;
  const costUsd = worker.costUsd ?? 0;

  db.prepare(
    `INSERT INTO workers (id, leader_id, meeting_id, task_description, task_type, status, input_context, output_result, error_message, dependencies, spawned_at, completed_at, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    worker.leaderId,
    worker.meetingId,
    worker.taskDescription,
    worker.taskType,
    status,
    worker.inputContext,
    worker.outputResult,
    worker.errorMessage,
    JSON.stringify(worker.dependencies),
    spawnedAt,
    completedAt,
    costUsd
  );

  return {
    id,
    leaderId: worker.leaderId,
    meetingId: worker.meetingId,
    taskDescription: worker.taskDescription,
    taskType: worker.taskType,
    status,
    inputContext: worker.inputContext,
    outputResult: worker.outputResult,
    errorMessage: worker.errorMessage,
    dependencies: worker.dependencies,
    spawnedAt,
    completedAt,
    costUsd,
  };
}

export function getWorker(id: string): WorkerRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM workers WHERE id = ?').get(id) as WorkerRow | undefined;
  return row ? rowToWorker(row) : null;
}

export function updateWorker(
  id: string,
  updates: Partial<Omit<WorkerRecord, 'id'>>
): WorkerRecord | null {
  const db = getDb();
  const existing = getWorker(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.leaderId !== undefined) { fields.push('leader_id = ?'); values.push(updates.leaderId); }
  if (updates.meetingId !== undefined) { fields.push('meeting_id = ?'); values.push(updates.meetingId); }
  if (updates.taskDescription !== undefined) { fields.push('task_description = ?'); values.push(updates.taskDescription); }
  if (updates.taskType !== undefined) { fields.push('task_type = ?'); values.push(updates.taskType); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.inputContext !== undefined) { fields.push('input_context = ?'); values.push(updates.inputContext); }
  if (updates.outputResult !== undefined) { fields.push('output_result = ?'); values.push(updates.outputResult); }
  if (updates.errorMessage !== undefined) { fields.push('error_message = ?'); values.push(updates.errorMessage); }
  if (updates.dependencies !== undefined) { fields.push('dependencies = ?'); values.push(JSON.stringify(updates.dependencies)); }
  if (updates.spawnedAt !== undefined) { fields.push('spawned_at = ?'); values.push(updates.spawnedAt); }
  if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(updates.completedAt); }
  if (updates.costUsd !== undefined) { fields.push('cost_usd = ?'); values.push(updates.costUsd); }

  if (fields.length === 0) return existing;

  values.push(id);
  db.prepare(`UPDATE workers SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getWorker(id);
}

export function listWorkersByLeader(leaderId: string): WorkerRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM workers WHERE leader_id = ? ORDER BY spawned_at ASC')
    .all(leaderId) as WorkerRow[];
  return rows.map(rowToWorker);
}
