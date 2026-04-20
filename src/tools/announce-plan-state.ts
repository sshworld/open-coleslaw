import { z } from 'zod';
import { eventBus } from '../orchestrator/event-bus.js';

const question = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string()).min(2),
});

const answer = z.object({
  id: z.string().min(1),
  picked: z.string(),
});

export const announcePlanStateSchema = {
  phase: z
    .enum(['entered', 'clarify-asked', 'clarify-answered', 'plan-presented', 'resolved'])
    .describe(
      'Lifecycle phase of the current plan-mode cycle. Call once per boundary.',
    ),
  cycle: z
    .enum(['kickoff', 'design', 'verify-retry'])
    .optional()
    .describe(
      'Which cycle the plan mode wraps. Required on `entered`; carried forward on later phases.',
    ),
  questions: z
    .array(question)
    .optional()
    .describe('Clarify questions. Required on phase=clarify-asked.'),
  answers: z
    .array(answer)
    .optional()
    .describe('User picks. Required on phase=clarify-answered.'),
  plan: z
    .string()
    .optional()
    .describe('The plan text passed to ExitPlanMode. Required on phase=plan-presented.'),
  outcome: z
    .enum(['auto-accept', 'manual-approve', 'rejected'])
    .optional()
    .describe('How the user resolved the plan. Required on phase=resolved.'),
  feedback: z
    .string()
    .optional()
    .describe('User rejection feedback. Required when outcome=rejected.'),
};

type Phase = 'entered' | 'clarify-asked' | 'clarify-answered' | 'plan-presented' | 'resolved';

export async function announcePlanStateHandler({
  phase,
  cycle,
  questions,
  answers,
  plan,
  outcome,
  feedback,
}: {
  phase: Phase;
  cycle?: 'kickoff' | 'design' | 'verify-retry';
  questions?: Array<{ id: string; question: string; options: string[] }>;
  answers?: Array<{ id: string; picked: string }>;
  plan?: string;
  outcome?: 'auto-accept' | 'manual-approve' | 'rejected';
  feedback?: string;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    // Per-phase required fields
    if (phase === 'entered' && !cycle) {
      throw new Error('`cycle` is required on phase=entered');
    }
    if (phase === 'clarify-asked' && (!questions || questions.length === 0)) {
      throw new Error('`questions` is required on phase=clarify-asked');
    }
    if (phase === 'clarify-answered' && (!answers || answers.length === 0)) {
      throw new Error('`answers` is required on phase=clarify-answered');
    }
    if (phase === 'plan-presented' && !plan) {
      throw new Error('`plan` is required on phase=plan-presented');
    }
    if (phase === 'resolved' && !outcome) {
      throw new Error('`outcome` is required on phase=resolved');
    }
    if (phase === 'resolved' && outcome === 'rejected' && !feedback) {
      throw new Error('`feedback` is required when outcome=rejected');
    }

    eventBus.emitAgentEvent({
      kind: 'plan_state',
      phase,
      ...(cycle ? { cycle } : {}),
      ...(questions ? { questions } : {}),
      ...(answers ? { answers } : {}),
      ...(plan ? { plan } : {}),
      ...(outcome ? { outcome } : {}),
      ...(feedback ? { feedback } : {}),
    });

    return {
      content: [
        { type: 'text', text: JSON.stringify({ announced: phase }, null, 2) },
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
