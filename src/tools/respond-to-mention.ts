import { z } from 'zod';
import { getMention, updateMention } from '../storage/index.js';
import { eventBus } from '../orchestrator/event-bus.js';

export const respondToMentionSchema = {
  mentionId: z.string().describe('ID of the mention to respond to'),
  decision: z.string().describe('The decision made by the user'),
  reasoning: z.string().optional().describe('Optional reasoning for the decision'),
};

export async function respondToMentionHandler({
  mentionId,
  decision,
  reasoning,
}: {
  mentionId: string;
  decision: string;
  reasoning?: string;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const mention = getMention(mentionId);

    if (!mention) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { error: `Mention not found: ${mentionId}` },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    if (mention.status === 'resolved') {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { error: `Mention already resolved: ${mentionId}` },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    const resolved = updateMention(mentionId, {
      status: 'resolved',
      userDecision: decision,
      userReasoning: reasoning ?? null,
      resolvedAt: Date.now(),
    });

    eventBus.emitAgentEvent({
      kind: 'mention_resolved',
      mentionId,
      decision,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { success: true, mention: resolved },
            null,
            2,
          ),
        },
      ],
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
