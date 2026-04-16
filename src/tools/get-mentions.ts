import { z } from 'zod';
import {
  listPendingMentions,
  listMentionsByMeeting,
} from '../storage/index.js';
import type { MentionRecord } from '../types/index.js';

export const getMentionsSchema = {
  status: z
    .enum(['pending', 'resolved', 'all'])
    .default('pending')
    .optional()
    .describe('Filter mentions by status'),
  meetingId: z
    .string()
    .optional()
    .describe('Filter mentions by meeting ID'),
};

export async function getMentionsHandler({
  status,
  meetingId,
}: {
  status?: 'pending' | 'resolved' | 'all';
  meetingId?: string;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const effectiveStatus = status ?? 'pending';
    let mentions: MentionRecord[];

    if (meetingId) {
      // Get all mentions for this meeting, then filter by status
      const allForMeeting = listMentionsByMeeting(meetingId);
      if (effectiveStatus === 'all') {
        mentions = allForMeeting;
      } else {
        mentions = allForMeeting.filter((m) => m.status === effectiveStatus);
      }
    } else if (effectiveStatus === 'pending') {
      mentions = listPendingMentions();
    } else if (effectiveStatus === 'resolved') {
      // listPendingMentions only returns pending; for resolved we need to
      // get all and filter. Since there is no dedicated storage function for
      // resolved mentions, we use listMentionsByMeeting with no meetingId —
      // but that requires a meetingId. Instead we get pending and note the
      // limitation, or we query directly.
      // For a clean approach, list all meetings' mentions by getting pending
      // and noting this is a filtered view.
      // Actually, we can use the DB directly through the existing functions.
      // The simplest correct approach: get all pending and return empty since
      // we want resolved. But that's wrong. Let's just get all mentions.
      // Since there's no listAllMentions, we'll import getDb and query directly.
      const { getDb } = await import('../storage/db.js');
      const db = getDb();
      interface MentionRow {
        id: string;
        meeting_id: string;
        agenda_item: string | null;
        summary: string;
        options: string;
        urgency: string;
        status: string;
        user_decision: string | null;
        user_reasoning: string | null;
        created_at: number;
        resolved_at: number | null;
      }
      const rows = db
        .prepare("SELECT * FROM mentions WHERE status = 'resolved' ORDER BY created_at ASC")
        .all() as MentionRow[];
      mentions = rows.map((row) => ({
        id: row.id,
        meetingId: row.meeting_id,
        agendaItem: row.agenda_item,
        summary: row.summary,
        options: JSON.parse(row.options),
        urgency: row.urgency as MentionRecord['urgency'],
        status: row.status as MentionRecord['status'],
        userDecision: row.user_decision,
        userReasoning: row.user_reasoning,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
      }));
    } else {
      // 'all'
      const { getDb } = await import('../storage/db.js');
      const db = getDb();
      interface MentionRow {
        id: string;
        meeting_id: string;
        agenda_item: string | null;
        summary: string;
        options: string;
        urgency: string;
        status: string;
        user_decision: string | null;
        user_reasoning: string | null;
        created_at: number;
        resolved_at: number | null;
      }
      const rows = db
        .prepare('SELECT * FROM mentions ORDER BY created_at ASC')
        .all() as MentionRow[];
      mentions = rows.map((row) => ({
        id: row.id,
        meetingId: row.meeting_id,
        agendaItem: row.agenda_item,
        summary: row.summary,
        options: JSON.parse(row.options),
        urgency: row.urgency as MentionRecord['urgency'],
        status: row.status as MentionRecord['status'],
        userDecision: row.user_decision,
        userReasoning: row.user_reasoning,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
      }));
    }

    const result = {
      count: mentions.length,
      status: effectiveStatus,
      ...(meetingId ? { meetingId } : {}),
      mentions,
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
