import { z } from 'zod';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import type { Department } from '../types/index.js';

export const startMeetingSchema = {
  topic: z.string().describe('Meeting topic'),
  agenda: z.array(z.string()).describe('Agenda items'),
  meetingType: z
    .enum(['kickoff', 'design', 'verify-retry'])
    .optional()
    .describe(
      "Meeting type. 'kickoff' for MVP decomposition (planner + orchestrator). " +
        "'design' for per-MVP design (planner + dynamic specialists). " +
        "'verify-retry' for responding to verification failures.",
    ),
  departments: z
    .array(z.string())
    .optional()
    .describe('Specific departments to invite. If omitted, inferred from topic+agenda.'),
};

export async function startMeetingHandler({
  topic,
  agenda,
  meetingType,
  departments,
}: {
  topic: string;
  agenda: string[];
  meetingType?: 'kickoff' | 'design' | 'verify-retry';
  departments?: string[];
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const orchestrator = new Orchestrator();
    const result = orchestrator.startMeeting({
      topic,
      agenda,
      departments: departments as Department[] | undefined,
      meetingType,
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
