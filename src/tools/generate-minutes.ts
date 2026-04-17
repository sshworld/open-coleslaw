import { z } from 'zod';
import { MeetingRunner } from '../orchestrator/meeting-runner.js';
import { getMinutesByMeeting } from '../storage/index.js';
import { eventBus } from '../orchestrator/event-bus.js';

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

    // Emit dashboard event: the thread's decisions/action items panel updates.
    if (minutes) {
      const decisions = extractSection(minutes.content, 'Decisions');
      const actionItems = (minutes.actionItems ?? []).map((a) => a.title || a.description);
      eventBus.emitAgentEvent({
        kind: 'minutes_finalized',
        meetingId,
        decisions,
        actionItems,
      });
    }

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

/**
 * Pull bullets under a ## <heading> from the minutes markdown. Best-effort —
 * dashboard only uses this for a quick summary; the canonical minutes are on disk.
 */
function extractSection(md: string, heading: string): string[] {
  const lines = md.split('\n');
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      inSection = h[1].trim().toLowerCase().startsWith(heading.toLowerCase());
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^\s*[-*]\s+(.*\S)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}
