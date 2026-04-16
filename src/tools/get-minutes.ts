import { z } from 'zod';
import { getMinutesByMeeting } from '../storage/index.js';

export const getMinutesSchema = {
  meetingId: z.string().describe('Meeting ID'),
  format: z
    .enum(['full', 'summary', 'tasks_only'])
    .default('full')
    .optional()
    .describe('Output format'),
};

export async function getMinutesHandler({
  meetingId,
  format,
}: {
  meetingId: string;
  format?: 'full' | 'summary' | 'tasks_only';
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const minutes = getMinutesByMeeting(meetingId);
    if (!minutes) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { error: `No minutes found for meeting: ${meetingId}` },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    const effectiveFormat = format ?? 'full';

    let result: unknown;

    switch (effectiveFormat) {
      case 'full':
        result = {
          id: minutes.id,
          meetingId: minutes.meetingId,
          format: minutes.format,
          content: minutes.content,
          actionItems: minutes.actionItems,
          createdAt: minutes.createdAt,
        };
        break;

      case 'summary': {
        // Extract a summary: first 500 chars of content + action item count
        const summaryContent =
          minutes.content.length > 500
            ? minutes.content.slice(0, 500) + '...'
            : minutes.content;
        result = {
          id: minutes.id,
          meetingId: minutes.meetingId,
          summary: summaryContent,
          actionItemCount: minutes.actionItems.length,
          createdAt: minutes.createdAt,
        };
        break;
      }

      case 'tasks_only':
        result = {
          meetingId: minutes.meetingId,
          actionItems: minutes.actionItems,
          totalTasks: minutes.actionItems.length,
        };
        break;
    }

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
