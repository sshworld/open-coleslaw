import { z } from 'zod';
import {
  getMeeting,
  getMinutesByMeeting,
  listAgentsByMeeting,
  listWorkersByLeader,
} from '../storage/index.js';

export const getTaskReportSchema = {
  meetingId: z.string().describe('ID of the meeting to generate a report for'),
};

export async function getTaskReportHandler({
  meetingId,
}: {
  meetingId: string;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const meeting = getMeeting(meetingId);
    if (!meeting) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { error: `Meeting not found: ${meetingId}` },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    const minutes = getMinutesByMeeting(meetingId);
    const agents = listAgentsByMeeting(meetingId);

    // Collect all workers grouped by leader/department
    const departmentBreakdowns: Array<{
      department: string;
      leaderId: string;
      leaderRole: string;
      workers: Array<{
        id: string;
        taskDescription: string;
        status: string;
        costUsd: number;
        errorMessage: string | null;
      }>;
      completed: number;
      failed: number;
      pending: number;
      totalCost: number;
    }> = [];

    let totalCompleted = 0;
    let totalFailed = 0;
    let totalPending = 0;
    let totalCost = 0;

    for (const agent of agents) {
      const workers = listWorkersByLeader(agent.id);

      const completed = workers.filter((w) => w.status === 'completed').length;
      const failed = workers.filter((w) => w.status === 'failed').length;
      const pending = workers.filter(
        (w) => w.status === 'pending' || w.status === 'running',
      ).length;
      const deptCost = workers.reduce((acc, w) => acc + w.costUsd, 0);

      totalCompleted += completed;
      totalFailed += failed;
      totalPending += pending;
      totalCost += deptCost;

      if (workers.length > 0) {
        departmentBreakdowns.push({
          department: agent.department,
          leaderId: agent.id,
          leaderRole: agent.role,
          workers: workers.map((w) => ({
            id: w.id,
            taskDescription: w.taskDescription,
            status: w.status,
            costUsd: w.costUsd,
            errorMessage: w.errorMessage,
          })),
          completed,
          failed,
          pending,
          totalCost: deptCost,
        });
      }
    }

    const result = {
      meetingId,
      topic: meeting.topic,
      status: meeting.status,
      actionItemCount: minutes?.actionItems.length ?? 0,
      summary: {
        totalWorkers: totalCompleted + totalFailed + totalPending,
        completed: totalCompleted,
        failed: totalFailed,
        pending: totalPending,
        totalCost,
      },
      departments: departmentBreakdowns,
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
