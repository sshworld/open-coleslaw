import { z } from 'zod';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import type { Department } from '../types/index.js';

export const startMeetingSchema = {
  topic: z.string().describe('Meeting topic'),
  agenda: z.array(z.string()).describe('Agenda items'),
  departments: z
    .array(z.string())
    .optional()
    .describe('Specific departments to invite'),
};

export async function startMeetingHandler({
  topic,
  agenda,
  departments,
}: {
  topic: string;
  agenda: string[];
  departments?: string[];
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const orchestrator = new Orchestrator();
    const result = orchestrator.startMeeting({
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
