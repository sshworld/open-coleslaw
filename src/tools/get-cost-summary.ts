import { z } from 'zod';
import { costTracker } from '../utils/cost-tracker.js';

export const getCostSummarySchema = {
  meetingId: z.string().optional().describe('Optional meeting ID to filter costs'),
};

export async function getCostSummaryHandler({
  meetingId,
}: {
  meetingId?: string;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const summary = costTracker.getSummary(meetingId);
    const budgetWarning = costTracker.checkBudget();

    const result: Record<string, unknown> = {
      ...summary,
    };

    if (budgetWarning) {
      result.budgetWarning = budgetWarning;
    }

    if (meetingId) {
      result.filteredByMeeting = meetingId;
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
