import { z } from 'zod';
import { listMeetings } from '../storage/index.js';
import type { MeetingStatus } from '../types/index.js';

export const listMeetingsSchema = {
  status: z
    .enum(['pending', 'running', 'completed', 'cancelled', 'failed', 'all'])
    .default('all')
    .optional()
    .describe('Filter meetings by status'),
  limit: z
    .number()
    .default(20)
    .optional()
    .describe('Maximum number of meetings to return'),
};

// Map the user-facing "running" status to the internal statuses that represent
// an active/running meeting.
const RUNNING_STATUSES: MeetingStatus[] = [
  'convening',
  'opening',
  'discussion',
  'synthesis',
  'minutes-generation',
  'executing',
  'aggregation',
  'waiting-for-user',
];

export async function listMeetingsHandler({
  status,
  limit,
}: {
  status?: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed' | 'all';
  limit?: number;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const effectiveStatus = status ?? 'all';
    const effectiveLimit = limit ?? 20;

    let meetings;

    if (effectiveStatus === 'all') {
      meetings = listMeetings();
    } else if (effectiveStatus === 'running') {
      // "running" maps to multiple internal statuses
      const all = listMeetings();
      meetings = all.filter((m) => RUNNING_STATUSES.includes(m.status));
    } else {
      meetings = listMeetings(effectiveStatus as MeetingStatus);
    }

    // Apply limit
    const limited = meetings.slice(0, effectiveLimit);

    const result = {
      total: meetings.length,
      returned: limited.length,
      status: effectiveStatus,
      meetings: limited.map((m) => ({
        id: m.id,
        topic: m.topic,
        status: m.status,
        phase: m.phase,
        participantCount: m.participantIds.length,
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
