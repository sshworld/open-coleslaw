import { z } from 'zod';
import { getTasksFromMinutes } from '../storage/index.js';
import { WorkerManager } from '../orchestrator/worker-manager.js';
import type { TaskAssignment } from '../types/index.js';

export const executeTasksSchema = {
  meetingId: z.string().describe('Meeting ID'),
  taskIds: z
    .array(z.string())
    .optional()
    .describe('Specific tasks to execute, or all'),
};

export async function executeTasksHandler({
  meetingId,
  taskIds,
}: {
  meetingId: string;
  taskIds?: string[];
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const allTasks = getTasksFromMinutes(meetingId);

    if (allTasks.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: `No tasks found for meeting: ${meetingId}. Run compact-minutes first.`,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    // Filter tasks if specific IDs provided
    const tasksToExecute = taskIds
      ? allTasks.filter((t) => taskIds.includes(t.id))
      : allTasks;

    if (tasksToExecute.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { error: 'No matching tasks found for the provided task IDs.' },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    // Group tasks by department
    const tasksByDepartment = new Map<string, typeof tasksToExecute>();
    for (const task of tasksToExecute) {
      const dept = task.assignedDepartment;
      if (!tasksByDepartment.has(dept)) {
        tasksByDepartment.set(dept, []);
      }
      tasksByDepartment.get(dept)!.push(task);
    }

    const workerManager = new WorkerManager();
    const executionResults: Array<{
      department: string;
      taskCount: number;
      workers: Array<{
        id: string;
        status: string;
        taskDescription: string;
        outputResult: string | null;
        errorMessage: string | null;
      }>;
    }> = [];

    // Execute tasks per department
    for (const [department, tasks] of tasksByDepartment) {
      const assignments: TaskAssignment[] = tasks.map((task) => ({
        workerId: task.id,
        description: `${task.title}: ${task.description}`,
        inputPaths: [],
        outputPath: '',
        dependencies: task.dependencies,
        status: 'pending' as const,
        result: null,
      }));

      // Use a synthetic leader ID based on the department
      const leaderId = `${department}-leader-${meetingId}`;
      const workers = await workerManager.spawnWorkers(
        leaderId,
        meetingId,
        assignments,
      );

      const completedWorkers = await workerManager.executeWorkers(workers);

      executionResults.push({
        department,
        taskCount: tasks.length,
        workers: completedWorkers.map((w) => ({
          id: w.id,
          status: w.status,
          taskDescription: w.taskDescription,
          outputResult: w.outputResult,
          errorMessage: w.errorMessage,
        })),
      });
    }

    const totalWorkers = executionResults.reduce(
      (acc, r) => acc + r.workers.length,
      0,
    );
    const completedCount = executionResults.reduce(
      (acc, r) =>
        acc + r.workers.filter((w) => w.status === 'completed').length,
      0,
    );
    const failedCount = executionResults.reduce(
      (acc, r) => acc + r.workers.filter((w) => w.status === 'failed').length,
      0,
    );

    const result = {
      meetingId,
      summary: {
        totalTasks: tasksToExecute.length,
        totalWorkers,
        completed: completedCount,
        failed: failedCount,
      },
      departments: executionResults,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: 'text', text: JSON.stringify({ error: message }, null, 2) },
      ],
      isError: true,
    };
  }
}
