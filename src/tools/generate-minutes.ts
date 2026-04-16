import { z } from 'zod';
import { MeetingRunner } from '../orchestrator/meeting-runner.js';
import { getMinutesByMeeting } from '../storage/index.js';

export const generateMinutesSchema = {
  meetingId: z.string().describe('Meeting ID to generate minutes for'),
};

export async function generateMinutesHandler({
  meetingId,
}: {
  meetingId: string;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const runner = new MeetingRunner(meetingId);
    const minutesId = await runner.generateMinutes();

    // Fetch the generated minutes to include the content
    const minutes = getMinutesByMeeting(meetingId);

    const result = {
      minutesId,
      meetingId,
      content: minutes?.content ?? '',
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
