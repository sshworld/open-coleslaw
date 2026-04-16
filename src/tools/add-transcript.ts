import { z } from 'zod';
import { MeetingRunner } from '../orchestrator/meeting-runner.js';

export const addTranscriptSchema = {
  meetingId: z.string().describe('Meeting ID'),
  speakerRole: z.string().describe('Role of the speaker (e.g. "Architecture Lead", "Engineering Lead")'),
  agendaItemIndex: z
    .number()
    .describe('Agenda item index (0-based). Use -1 for opening statements, -2 for synthesis'),
  roundNumber: z.number().describe('Discussion round number (0 for opening/synthesis)'),
  content: z.string().describe('The transcript content from the speaker'),
};

export async function addTranscriptHandler({
  meetingId,
  speakerRole,
  agendaItemIndex,
  roundNumber,
  content,
}: {
  meetingId: string;
  speakerRole: string;
  agendaItemIndex: number;
  roundNumber: number;
  content: string;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const runner = new MeetingRunner(meetingId);
    const entry = runner.addTranscript(speakerRole, agendaItemIndex, roundNumber, content);

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
