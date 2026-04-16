import { z } from 'zod';
import {
  getMeeting,
  listMeetings,
  listAgentsByMeeting,
  listWorkersByLeader,
} from '../storage/index.js';

export const getMeetingStatusSchema = {
  meetingId: z
    .string()
    .optional()
    .describe('Specific meeting ID, or omit for all active'),
};

export async function getMeetingStatusHandler({
  meetingId,
}: {
  meetingId?: string;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    if (meetingId) {
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

      const agents = listAgentsByMeeting(meetingId);
      const workers = agents.flatMap((agent) =>
        listWorkersByLeader(agent.id),
      );

      const result = {
        meeting,
        agents,
        workers,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    // Return all active meetings summary
    const allMeetings = listMeetings();
    const activeMeetings = allMeetings.filter(
      (m) =>
        !['completed', 'cancelled', 'failed', 'reported', 'compacted'].includes(
          m.status,
        ),
    );

    const result = {
      totalMeetings: allMeetings.length,
      activeMeetings: activeMeetings.map((m) => ({
        id: m.id,
        topic: m.topic,
        status: m.status,
        phase: m.phase,
        startedAt: m.startedAt,
      })),
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
