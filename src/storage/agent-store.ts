import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';
import type { AgentNode, AgentTier, AgentStatus, Department } from '../types/index.js';

interface AgentRow {
  id: string;
  tier: string;
  role: string;
  department: string;
  parent_id: string | null;
  meeting_id: string | null;
  status: string;
  current_task: string | null;
  session_id: string | null;
  spawned_at: number;
  completed_at: number | null;
  cost_usd: number;
}

function rowToAgent(row: AgentRow): AgentNode {
  return {
    id: row.id,
    tier: row.tier as AgentTier,
    role: row.role,
    department: row.department as Department,
    parentId: row.parent_id,
    meetingId: row.meeting_id,
    status: row.status as AgentStatus,
    currentTask: row.current_task,
    sessionId: row.session_id,
    spawnedAt: row.spawned_at,
    completedAt: row.completed_at,
    costUsd: row.cost_usd,
  };
}

export function createAgent(
  agent: Omit<AgentNode, 'id' | 'spawnedAt' | 'completedAt' | 'costUsd'> & {
    id?: string;
    spawnedAt?: number;
    completedAt?: number | null;
    costUsd?: number;
  }
): AgentNode {
  const db = getDb();
  const id = agent.id ?? uuidv4();
  const spawnedAt = agent.spawnedAt ?? Date.now();
  const completedAt = agent.completedAt ?? null;
  const costUsd = agent.costUsd ?? 0;

  db.prepare(
    `INSERT INTO agents (id, tier, role, department, parent_id, meeting_id, status, current_task, session_id, spawned_at, completed_at, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    agent.tier,
    agent.role,
    agent.department,
    agent.parentId,
    agent.meetingId,
    agent.status,
    agent.currentTask,
    agent.sessionId,
    spawnedAt,
    completedAt,
    costUsd
  );

  return {
    id,
    tier: agent.tier,
    role: agent.role,
    department: agent.department,
    parentId: agent.parentId,
    meetingId: agent.meetingId,
    status: agent.status,
    currentTask: agent.currentTask,
    sessionId: agent.sessionId,
    spawnedAt,
    completedAt,
    costUsd,
  };
}

export function getAgent(id: string): AgentNode | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
  return row ? rowToAgent(row) : null;
}

export function updateAgent(
  id: string,
  updates: Partial<Omit<AgentNode, 'id'>>
): AgentNode | null {
  const db = getDb();
  const existing = getAgent(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.tier !== undefined) { fields.push('tier = ?'); values.push(updates.tier); }
  if (updates.role !== undefined) { fields.push('role = ?'); values.push(updates.role); }
  if (updates.department !== undefined) { fields.push('department = ?'); values.push(updates.department); }
  if (updates.parentId !== undefined) { fields.push('parent_id = ?'); values.push(updates.parentId); }
  if (updates.meetingId !== undefined) { fields.push('meeting_id = ?'); values.push(updates.meetingId); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.currentTask !== undefined) { fields.push('current_task = ?'); values.push(updates.currentTask); }
  if (updates.sessionId !== undefined) { fields.push('session_id = ?'); values.push(updates.sessionId); }
  if (updates.spawnedAt !== undefined) { fields.push('spawned_at = ?'); values.push(updates.spawnedAt); }
  if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(updates.completedAt); }
  if (updates.costUsd !== undefined) { fields.push('cost_usd = ?'); values.push(updates.costUsd); }

  if (fields.length === 0) return existing;

  values.push(id);
  db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getAgent(id);
}

export function listAgentsByMeeting(meetingId: string): AgentNode[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM agents WHERE meeting_id = ?')
    .all(meetingId) as AgentRow[];
  return rows.map(rowToAgent);
}

export function listAgentsByParent(parentId: string): AgentNode[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM agents WHERE parent_id = ?')
    .all(parentId) as AgentRow[];
  return rows.map(rowToAgent);
}

export interface AgentTreeNode extends AgentNode {
  children: AgentTreeNode[];
}

export function getAgentTree(rootId: string): AgentTreeNode | null {
  const agent = getAgent(rootId);
  if (!agent) return null;

  const children = listAgentsByParent(rootId);
  const treeNode: AgentTreeNode = {
    ...agent,
    children: children
      .map((child) => getAgentTree(child.id))
      .filter((node): node is AgentTreeNode => node !== null),
  };

  return treeNode;
}
