import { z } from 'zod';
import {
  createMvp,
  getMvp,
  listMvpsByKickoff,
  updateMvp,
  type MvpRecord,
  type MvpStatus,
} from '../storage/mvp-store.js';
import { eventBus } from '../orchestrator/event-bus.js';
import type { MvpSummary } from '../types/dashboard-events.js';
import { logger } from '../utils/logger.js';

const mvpInput = z.object({
  id: z.string().min(1).describe('Stable MVP id (e.g., "mvp-1")'),
  title: z.string().min(1),
  goal: z.string(),
  status: z.enum(['pending', 'in-progress', 'done', 'blocked']),
  orderIndex: z.number().int().min(0),
});

const patchInput = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'in-progress', 'done', 'blocked']).optional(),
});

export const updateMvpsSchema = {
  kickoffMeetingId: z
    .string()
    .optional()
    .describe('The kickoff meeting id these MVPs belong to. Required when `mvps` is provided.'),
  mvps: z
    .array(mvpInput)
    .optional()
    .describe(
      'Full MVP list to upsert. Use after the kickoff decompose step. Replaces the entire per-kickoff list.',
    ),
  patch: patchInput
    .optional()
    .describe(
      'Single-MVP patch. Use when an MVP transitions to in-progress (design meeting starts), done (verifier PASS), or blocked (verifier FAIL).',
    ),
};

function toSummary(r: MvpRecord): MvpSummary {
  return {
    id: r.id,
    title: r.title,
    goal: r.goal,
    status: r.status,
    orderIndex: r.orderIndex,
  };
}

export async function updateMvpsHandler({
  kickoffMeetingId,
  mvps,
  patch,
}: {
  kickoffMeetingId?: string;
  mvps?: Array<{
    id: string;
    title: string;
    goal: string;
    status: MvpStatus;
    orderIndex: number;
  }>;
  patch?: { id: string; status?: MvpStatus };
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    if (!mvps && !patch) {
      throw new Error('Provide either `mvps` (full list) or `patch` (single update).');
    }

    let current: MvpRecord[] = [];

    if (mvps) {
      if (!kickoffMeetingId) {
        throw new Error('`kickoffMeetingId` is required when `mvps` is provided.');
      }
      // Upsert: create if missing, update status + orderIndex otherwise.
      for (const m of mvps) {
        const existing = getMvp(m.id);
        if (existing) {
          updateMvp(m.id, { status: m.status });
        } else {
          createMvp({
            id: m.id,
            kickoffMeetingId,
            title: m.title,
            goal: m.goal,
            status: m.status,
            orderIndex: m.orderIndex,
          });
        }
      }
      current = listMvpsByKickoff(kickoffMeetingId);
    }

    if (patch) {
      const existing = getMvp(patch.id);
      if (!existing) {
        throw new Error(`MVP not found: ${patch.id}`);
      }
      const completedAt = patch.status === 'done' ? Date.now() : undefined;
      updateMvp(patch.id, {
        status: patch.status,
        ...(completedAt !== undefined ? { completedAt } : {}),
      });
      current = listMvpsByKickoff(existing.kickoffMeetingId);
    }

    const summaries = current.map(toSummary);
    eventBus.emitAgentEvent({ kind: 'mvp_progress', mvps: summaries });
    logger.info(
      `update-mvps: emitted mvp_progress with ${summaries.length} MVP(s)`,
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ mvps: summaries }, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
      isError: true,
    };
  }
}
