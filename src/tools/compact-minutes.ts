import { z } from 'zod';
import { Compactor } from '../meeting/compactor.js';

export const compactMinutesSchema = {
  meetingId: z.string().describe('Meeting ID'),
  additionalInstructions: z
    .string()
    .optional()
    .describe('Additional instructions for compaction'),
};

export async function compactMinutesHandler({
  meetingId,
  additionalInstructions,
}: {
  meetingId: string;
  additionalInstructions?: string;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const compactor = new Compactor();
    const tasks = await compactor.compactMinutes(
      meetingId,
      additionalInstructions,
    );

    const result = {
      meetingId,
      tasksGenerated: tasks.length,
      tasks,
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
