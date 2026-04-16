import { getDb } from './db.js';
import type { ActionItem } from '../types/index.js';

interface MinutesRow {
  id: string;
  meeting_id: string;
  action_items: string;
}

export function getTasksFromMinutes(meetingId: string): ActionItem[] {
  const db = getDb();
  const row = db
    .prepare('SELECT action_items FROM minutes WHERE meeting_id = ?')
    .get(meetingId) as Pick<MinutesRow, 'action_items'> | undefined;

  if (!row) return [];

  return JSON.parse(row.action_items) as ActionItem[];
}

export function updateTaskInMinutes(
  meetingId: string,
  taskId: string,
  updates: Partial<Omit<ActionItem, 'id'>>
): ActionItem | null {
  const db = getDb();
  const row = db
    .prepare('SELECT id, action_items FROM minutes WHERE meeting_id = ?')
    .get(meetingId) as Pick<MinutesRow, 'id' | 'action_items'> | undefined;

  if (!row) return null;

  const actionItems = JSON.parse(row.action_items) as ActionItem[];
  const index = actionItems.findIndex((item) => item.id === taskId);

  if (index === -1) return null;

  const updated: ActionItem = { ...actionItems[index], ...updates, id: taskId };
  actionItems[index] = updated;

  db.prepare('UPDATE minutes SET action_items = ? WHERE id = ?').run(
    JSON.stringify(actionItems),
    row.id
  );

  return updated;
}
