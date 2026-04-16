import { v4 as uuidv4 } from 'uuid';
import type { WorkerRecord, TaskAssignment, TaskType, Department } from '../types/index.js';
import {
  createWorker,
  updateWorker,
  listWorkersByLeader,
} from '../storage/index.js';
import { createAgentConfig } from '../agents/agent-factory.js';
import { invokeClaude, buildInvokeOptions } from '../agents/claude-invoker.js';
import { getLeaderSystemPrompt } from '../agents/leader-prompts.js';
import { buildWorkerPrompt } from '../agents/worker-prompts.js';
import { eventBus } from './event-bus.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Worker execution — uses Claude CLI or falls back to mock
// ---------------------------------------------------------------------------

/**
 * Execute a worker by invoking Claude CLI as a subprocess.
 *
 * When COLESLAW_MOCK=1 is set or the `claude` CLI is not available, the
 * underlying `invokeClaude` function automatically falls back to mock responses.
 */
async function executeWorkerAgent(worker: WorkerRecord): Promise<string> {
  // Infer the department from the task type or default to engineering
  const department: Department = inferDepartment(worker);

  // Infer a worker role from the task type
  const workerRole = inferWorkerRole(worker);

  const agentConfig = createAgentConfig({
    tier: 'worker',
    role: workerRole,
    department,
    task: worker.taskDescription,
    context: worker.inputContext ?? undefined,
  });

  const systemPrompt = buildWorkerPrompt({
    workerType: workerRole as import('../types/index.js').WorkerType,
    department,
    task: worker.taskDescription,
    context: worker.inputContext ?? undefined,
  });

  const prompt =
    `Execute the following task:\n\n` +
    `Task: ${worker.taskDescription}\n` +
    (worker.inputContext ? `\nContext: ${worker.inputContext}\n` : '') +
    `\nProvide a clear, structured result.`;

  const invokeOpts = buildInvokeOptions(agentConfig, prompt, systemPrompt);

  // Workers get a 5-minute timeout
  invokeOpts.timeoutMs = 300_000;

  const result = await invokeClaude(invokeOpts);

  if (!result.success) {
    throw new Error(result.error ?? 'Worker agent invocation failed');
  }

  return result.output;
}

/**
 * Infer the department a worker belongs to based on its task type.
 */
function inferDepartment(worker: WorkerRecord): Department {
  switch (worker.taskType) {
    case 'research':
      return 'research';
    case 'testing':
      return 'qa';
    case 'analysis':
      return 'architecture';
    case 'implementation':
    default:
      return 'engineering';
  }
}

/**
 * Infer a specific worker role from the task description and type.
 */
function inferWorkerRole(worker: WorkerRecord): string {
  const desc = worker.taskDescription.toLowerCase();

  // Architecture roles
  if (desc.includes('schema') || desc.includes('data model')) return 'schema-designer';
  if (desc.includes('api') || desc.includes('endpoint')) return 'api-designer';
  if (desc.includes('dependency') || desc.includes('coupling')) return 'dependency-analyzer';

  // QA roles
  if (desc.includes('test')) return 'test-writer';
  if (desc.includes('security') || desc.includes('audit')) return 'security-auditor';
  if (desc.includes('performance') || desc.includes('benchmark')) return 'perf-tester';

  // Research roles
  if (desc.includes('research') || desc.includes('explore') || desc.includes('investigate')) return 'code-explorer';
  if (desc.includes('document') || desc.includes('search')) return 'doc-searcher';

  // Engineering roles
  if (desc.includes('fix') || desc.includes('bug')) return 'bug-fixer';
  if (desc.includes('refactor')) return 'refactorer';

  // Default to feature-dev for implementation tasks
  return 'feature-dev';
}

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
// WorkerManager
// ---------------------------------------------------------------------------

export class WorkerManager {
  // ---- spawn workers ------------------------------------------------------

  /**
   * Spawn a batch of workers on behalf of a leader.
   *
   * Each task assignment is persisted to SQLite and an `agent_spawned` event is
   * emitted.  The returned records are in `pending` status.
   */
  async spawnWorkers(
    leaderId: string,
    meetingId: string,
    tasks: TaskAssignment[],
  ): Promise<WorkerRecord[]> {
    const workers: WorkerRecord[] = [];

    for (const task of tasks) {
      const worker = createWorker({
        leaderId,
        meetingId,
        taskDescription: task.description,
        taskType: inferTaskType(task.description),
        inputContext: task.inputPaths.length > 0 ? task.inputPaths.join(', ') : null,
        outputResult: null,
        errorMessage: null,
        dependencies: task.dependencies,
      });

      workers.push(worker);

      logger.info(`Spawned worker for leader ${leaderId}`, {
        agentId: worker.id,
        meetingId,
        department: 'worker',
      });

      eventBus.emitAgentEvent({
        kind: 'agent_spawned',
        agentId: worker.id,
        agentType: 'worker',
        parentId: leaderId,
        label: task.description.slice(0, 60),
        department: 'engineering', // Workers inherit; refined later if needed
      });
    }

    return workers;
  }

  // ---- execute workers ----------------------------------------------------

  /**
   * Execute a list of workers, respecting dependency ordering.
   *
   * - Workers with no unresolved dependencies run in parallel.
   * - Workers whose dependencies are all completed run next.
   * - Continues until all workers are done or a dependency cycle is detected.
   */
  async executeWorkers(workers: WorkerRecord[]): Promise<WorkerRecord[]> {
    const completed = new Set<string>();
    const results: WorkerRecord[] = [];
    const pending = new Map(workers.map((w) => [w.id, w]));

    while (pending.size > 0) {
      // Find workers whose dependencies are all satisfied
      const ready: WorkerRecord[] = [];
      for (const worker of pending.values()) {
        const depsReady = worker.dependencies.every((dep) => completed.has(dep));
        if (depsReady) {
          ready.push(worker);
        }
      }

      if (ready.length === 0) {
        // All remaining workers have unsatisfied deps — break to avoid infinite loop
        logger.warn('Dependency cycle or unsatisfiable deps detected; failing remaining workers');
        for (const worker of pending.values()) {
          const failed = updateWorker(worker.id, {
            status: 'failed',
            errorMessage: 'Unresolvable dependency',
            completedAt: Date.now(),
          });
          results.push(failed ?? worker);

          eventBus.emitAgentEvent({
            kind: 'task_completed',
            agentId: worker.id,
            result: 'failure',
          });
        }
        break;
      }

      // Execute ready batch in parallel
      const batchResults = await Promise.allSettled(
        ready.map(async (worker) => {
          // Mark running
          updateWorker(worker.id, { status: 'running' });
          eventBus.emitAgentEvent({
            kind: 'state_changed',
            agentId: worker.id,
            from: 'idle',
            to: 'working',
          });

          try {
            const output = await executeWorkerAgent(worker);
            const updated = updateWorker(worker.id, {
              status: 'completed',
              outputResult: output,
              completedAt: Date.now(),
              costUsd: 0.01, // Approximate cost; real cost tracked by CLI
            });

            eventBus.emitAgentEvent({
              kind: 'task_completed',
              agentId: worker.id,
              result: 'success',
            });

            return updated ?? worker;
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const updated = updateWorker(worker.id, {
              status: 'failed',
              errorMessage: errorMsg,
              completedAt: Date.now(),
            });

            eventBus.emitAgentEvent({
              kind: 'task_completed',
              agentId: worker.id,
              result: 'failure',
            });

            return updated ?? worker;
          }
        }),
      );

      for (let i = 0; i < ready.length; i++) {
        const worker = ready[i];
        pending.delete(worker.id);
        completed.add(worker.id);

        const settlement = batchResults[i];
        if (settlement.status === 'fulfilled') {
          results.push(settlement.value);
        } else {
          results.push(worker);
        }
      }
    }

    return results;
  }

  // ---- status query -------------------------------------------------------

  /**
   * Get the current status of all workers under a given leader.
   */
  getWorkerStatus(leaderId: string): WorkerRecord[] {
    return listWorkersByLeader(leaderId);
  }
}
