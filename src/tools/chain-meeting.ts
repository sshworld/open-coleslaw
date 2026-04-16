import { z } from 'zod';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import type { Department } from '../types/index.js';

export const chainMeetingSchema = {
  previousMeetingId: z.string().describe('ID of the previous meeting to chain from'),
  topic: z.string().describe('Topic for the new chained meeting'),
  agenda: z.array(z.string()).describe('Agenda items for the new meeting'),
  departments: z
    .array(z.string())
    .optional()
    .describe('Specific departments to invite'),
};

export async function chainMeetingHandler({
  previousMeetingId,
  topic,
  agenda,
  departments,
}: {
  previousMeetingId: string;
  topic: string;
  agenda: string[];
  departments?: string[];
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const orchestrator = new Orchestrator();
    const result = orchestrator.chainMeeting({
      previousMeetingId,
      topic,
      agenda,
      departments: departments as Department[] | undefined,
    });

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
