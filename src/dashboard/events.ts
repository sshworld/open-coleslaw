/**
 * Dashboard event types — re-exported from the core types with serialization helpers.
 */

export type {
  MeetingThread,
  MeetingThreadStatus,
  MeetingType,
  ThreadComment,
  MvpSummary,
  Stance,
  AgentEvent,
  ProjectSession,
  RegisterMessage,
  SessionEventMessage,
  UnregisterMessage,
  UserCommentMessage,
  ServerMessage,
  SessionSnapshot,
  MultiSessionSnapshot,
  SessionDelta,
  SessionRegistered,
  SessionUnregistered,
} from '../types/dashboard-events.js';

export type { AgentTier, AgentStatus } from '../types/agent.js';
export type { MeetingPhase } from '../types/meeting.js';

import type {
  AgentEvent,
  MultiSessionSnapshot,
  SessionDelta,
} from '../types/dashboard-events.js';

export type AnyServerPayload =
  | MultiSessionSnapshot
  | SessionDelta
  | { type: 'session-registered'; sessionId: string; displayName: string; projectPath: string }
  | { type: 'session-unregistered'; sessionId: string };

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

export function serializeEvent(event: AnyServerPayload): string {
  return JSON.stringify(event);
}

export function deserializeEvent(raw: string): AnyServerPayload | null {
  try {
    return JSON.parse(raw) as AnyServerPayload;
  } catch {
    return null;
  }
}

/**
 * Create a human-readable summary of an AgentEvent for logging.
 */
export function summarizeEvent(event: AgentEvent): string {
  switch (event.kind) {
    case 'meeting_started':
      return `[MEETING] ${event.meetingType}: "${event.topic}" (${event.participants.join(', ')})`;
    case 'transcript_added':
      return `[SPEAK] ${event.comment.speakerRole} (r${event.comment.roundNumber})`;
    case 'round_advanced':
      return `[ROUND] item ${event.agendaItemIndex}, round ${event.roundNumber}`;
    case 'consensus_checked':
      return `[CONSENSUS] ${event.allAgreed ? 'all agreed' : 'dissent remains'}`;
    case 'minutes_finalized':
      return `[MINUTES] ${event.decisions.length} decisions, ${event.actionItems.length} action items`;
    case 'user_comment_added':
      return `[USER:${event.source}] ${event.content.slice(0, 60)}`;
    case 'mvp_progress':
      return `[MVP] ${event.mvps.filter((m) => m.status === 'done').length}/${event.mvps.length} done`;
    case 'mention_created':
      return `[@MENTION] ${event.summary} (${event.urgency})`;
    case 'mention_resolved':
      return `[@RESOLVED] ${event.mentionId}: ${event.decision}`;
    case 'cost_update':
      return `[COST] Total: $${event.totalCost.toFixed(4)}`;
    case 'plan_state':
      return `[PLAN-MODE] ${event.phase}${event.cycle ? ` (${event.cycle})` : ''}${event.outcome ? ` → ${event.outcome}` : ''}`;
  }
}
