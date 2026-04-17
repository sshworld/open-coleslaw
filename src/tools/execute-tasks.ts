import { z } from 'zod';
import { getTasksFromMinutes } from '../storage/index.js';

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
                error: `No tasks found for meeting: ${meetingId}. Ensure the meeting's minutes include action items.`,
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

    // Group tasks by department for the caller
    const tasksByDepartment = new Map<string, typeof tasksToExecute>();
    for (const task of tasksToExecute) {
      const dept = task.assignedDepartment;
      if (!tasksByDepartment.has(dept)) {
        tasksByDepartment.set(dept, []);
      }
      tasksByDepartment.get(dept)!.push(task);
    }

    const departments: Array<{
      department: string;
      tasks: typeof tasksToExecute;
    }> = [];

    for (const [department, tasks] of tasksByDepartment) {
      departments.push({ department, tasks });
    }

    const result = {
      meetingId,
      totalTasks: tasksToExecute.length,
      departments,
      instructions:
        'These tasks should be dispatched to implementer agents. ' +
        'The orchestrator agent will use Claude Code Agent tool to run each task.',
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
