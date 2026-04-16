/**
 * Mid-meeting research break detection and formatting.
 *
 * Leaders can request a research break by including a marker in their
 * response:  [RESEARCH_BREAK: <question>]
 *
 * The orchestrator pauses the meeting, dispatches a research worker, and
 * injects the result back into the meeting context.
 */

import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResearchBreakRequest {
  requestingLeader: string;
  question: string;
  estimatedDuration: 'quick' | 'medium';
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

const RESEARCH_MARKER_REGEX = /\[RESEARCH_BREAK:\s*(.+?)\]/;

/**
 * Detect a research break request in a leader's response.
 *
 * Looks for `[RESEARCH_BREAK: <question>]` markers.
 * Returns the parsed request, or null if no marker found.
 */
export function detectResearchBreak(
  response: string,
): ResearchBreakRequest | null {
  const match = RESEARCH_MARKER_REGEX.exec(response);
  if (!match) {
    return null;
  }

  const question = match[1].trim();

  // Estimate duration based on question complexity (simple heuristic)
  const isQuick =
    question.length < 80 &&
    !question.toLowerCase().includes('compare') &&
    !question.toLowerCase().includes('benchmark') &&
    !question.toLowerCase().includes('analyze');

  const request: ResearchBreakRequest = {
    requestingLeader: '', // caller fills this in with the actual leader ID
    question,
    estimatedDuration: isQuick ? 'quick' : 'medium',
  };

  logger.info('Research break detected', {
    question,
    estimatedDuration: request.estimatedDuration,
  } as Record<string, unknown>);

  return request;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format research results to inject back into the meeting context.
 *
 * The formatted block is prepended to the next speaker's context so all
 * participants can see the research findings.
 */
export function formatResearchResult(
  request: ResearchBreakRequest,
  result: string,
): string {
  return [
    '---',
    `**Research Break Result** (requested by ${request.requestingLeader})`,
    `**Question**: ${request.question}`,
    '',
    result,
    '---',
  ].join('\n');
}
