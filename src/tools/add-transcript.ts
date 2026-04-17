import { z } from 'zod';
import { MeetingRunner } from '../orchestrator/meeting-runner.js';
import { eventBus } from '../orchestrator/event-bus.js';
import type { Stance } from '../types/dashboard-events.js';

export const addTranscriptSchema = {
  meetingId: z.string().describe('Meeting ID'),
  speakerRole: z.string().describe('Role of the speaker (e.g. "planner", "architect", "engineer", "user")'),
  agendaItemIndex: z
    .number()
    .describe('Agenda item index (0-based). Use -1 for opening statements, -2 for synthesis, -3 for user interjections.'),
  roundNumber: z.number().describe('Discussion round number (0 for opening/synthesis)'),
  content: z.string().describe('The transcript content from the speaker'),
  stance: z
    .enum(['agree', 'disagree', 'speaking'])
    .optional()
    .describe("Optional stance — used when the speaker is answering a consensus check."),
};

export async function addTranscriptHandler({
  meetingId,
  speakerRole,
  agendaItemIndex,
  roundNumber,
  content,
  stance,
}: {
  meetingId: string;
  speakerRole: string;
  agendaItemIndex: number;
  roundNumber: number;
  content: string;
  stance?: Stance;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const runner = new MeetingRunner(meetingId);
    const entry = runner.addTranscript(speakerRole, agendaItemIndex, roundNumber, content);

    // Emit dashboard event so the live thread updates.
    eventBus.emitAgentEvent({
      kind: 'transcript_added',
      meetingId,
      comment: {
        id: entry.id,
        speakerRole,
        agendaItemIndex,
        roundNumber,
        content,
        stance: stance ?? 'speaking',
        createdAt: entry.createdAt,
      },
    });

    const result = {
      success: true,
      entryId: entry.id,
      meetingId,
      speakerRole,
      agendaItemIndex,
      roundNumber,
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
