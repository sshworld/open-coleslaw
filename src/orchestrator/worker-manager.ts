import { v4 as uuidv4 } from 'uuid';
import type { WorkerRecord, TaskType, Department } from '../types/index.js';
import {
  createWorker,
  updateWorker,
  listWorkersByLeader,
} from '../storage/index.js';
import { getDb } from '../storage/db.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferTaskType(description: string): TaskType {
  const lower = description.toLowerCase();
  if (lower.includes('research') || lower.includes('explore') || lower.includes('search')) {
    return 'research';
  }
  if (lower.includes('test') || lower.includes('audit') || lower.includes('benchmark')) {
    return 'testing';
  }
  if (lower.includes('analys') || lower.includes('design') || lower.includes('schema')) {
    return 'analysis';
  }
  return 'implementation';
}

// ---------------------------------------------------------------------------
// WorkerManager — simple task tracker (no agent invocation)
//
// Records task start/completion in the DB. Actual agent dispatch is handled
// by Claude Code's Agent tool, orchestrated by skill/agent markdown files.
// ---------------------------------------------------------------------------

export class WorkerManager {
  // ---- record task start ---------------------------------------------------

  /**
   * Record that a task was started. Creates a worker record in the DB.
   * Returns the workerId.
   */
  recordTaskStart(
    meetingId: string,
    taskDescription: string,
    department: string,
  ): string {
    const leaderId = `${department}-leader-${meetingId}`;

    const worker = createWorker({
      leaderId,
      meetingId,
      taskDescription,
      taskType: inferTaskType(taskDescription),
      inputContext: null,
      outputResult: null,
      errorMessage: null,
      dependencies: [],
    });

    logger.info(`Task recorded: ${taskDescription.slice(0, 60)}`, {
      agentId: worker.id,
      meetingId,
      department,
    });

    return worker.id;
  }

  // ---- record task completion ----------------------------------------------

  /**
   * Record task completion with result.
   */
  recordTaskComplete(workerId: string, result: string, success: boolean): void {
    updateWorker(workerId, {
      status: success ? 'completed' : 'failed',
      outputResult: success ? result : null,
      errorMessage: success ? null : result,
      completedAt: Date.now(),
    });

    logger.info(`Task ${success ? 'completed' : 'failed'}: ${workerId}`);
  }

  // ---- get task status -----------------------------------------------------

  /**
   * Get task status for all workers associated with a meeting.
   */
  getTaskStatus(meetingId: string): WorkerRecord[] {
    const db = getDb();

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

    const rows = db
      .prepare('SELECT * FROM workers WHERE meeting_id = ? ORDER BY spawned_at ASC')
      .all(meetingId) as WorkerRow[];

    return rows.map((r) => ({
      id: r.id,
      leaderId: r.leader_id,
      meetingId: r.meeting_id,
      taskDescription: r.task_description,
      taskType: r.task_type as TaskType | null,
      status: r.status as WorkerRecord['status'],
      inputContext: r.input_context,
      outputResult: r.output_result,
      errorMessage: r.error_message,
      dependencies: JSON.parse(r.dependencies) as string[],
      spawnedAt: r.spawned_at,
      completedAt: r.completed_at,
      costUsd: r.cost_usd,
    }));
  }

  // ---- legacy support: get workers by leader --------------------------------

  /**
   * Get the current status of all workers under a given leader.
   */
  getWorkerStatus(leaderId: string): WorkerRecord[] {
    return listWorkersByLeader(leaderId);
  }
}
