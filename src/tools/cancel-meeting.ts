import { z } from 'zod';
import {
  getMeeting,
  updateMeeting,
  listAgentsByMeeting,
  updateAgent,
  listWorkersByLeader,
  updateWorker,
} from '../storage/index.js';
import { eventBus } from '../orchestrator/event-bus.js';

export const cancelMeetingSchema = {
  meetingId: z.string().describe('ID of the meeting to cancel'),
  reason: z.string().optional().describe('Reason for cancellation'),
};

export async function cancelMeetingHandler({
  meetingId,
  reason,
}: {
  meetingId: string;
  reason?: string;
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

    if (meeting.status === 'completed' || meeting.status === 'cancelled') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: `Meeting cannot be cancelled: current status is '${meeting.status}'`,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    // Update meeting status to cancelled
    updateMeeting(meetingId, { status: 'cancelled', completedAt: Date.now() });

    // Find all agents for this meeting and mark them as completed
    const agents = listAgentsByMeeting(meetingId);
    let agentsCancelled = 0;
    let workersFailed = 0;

    for (const agent of agents) {
      if (agent.status !== 'completed' && agent.status !== 'failed') {
        updateAgent(agent.id, { status: 'completed', completedAt: Date.now() });
        agentsCancelled++;

        eventBus.emitAgentEvent({
          kind: 'state_changed',
          agentId: agent.id,
          from: agent.status,
          to: 'completed',
        });
      }

      // Find all workers for this agent (leader) and mark them as failed
      const workers = listWorkersByLeader(agent.id);
      for (const worker of workers) {
        if (worker.status !== 'completed' && worker.status !== 'failed') {
          updateWorker(worker.id, {
            status: 'failed',
            errorMessage: reason ?? 'Meeting cancelled',
            completedAt: Date.now(),
          });
          workersFailed++;

          eventBus.emitAgentEvent({
            kind: 'task_completed',
            agentId: worker.id,
            result: 'failure',
          });
        }
      }
    }

    const result = {
      success: true,
      meetingId,
      previousStatus: meeting.status,
      reason: reason ?? 'No reason provided',
      agentsCancelled,
      workersFailed,
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
