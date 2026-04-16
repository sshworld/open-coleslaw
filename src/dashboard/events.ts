/**
 * Dashboard event types — re-exported from the core types with serialization helpers.
 */

export type {
  AgentState,
  EdgeState,
  MeetingState,
  DashboardEvent,
  AgentEvent,
  ProjectSession,
  RegisterMessage,
  SessionEventMessage,
  UnregisterMessage,
  ServerMessage,
  MultiSessionSnapshot,
  SessionDelta,
  SessionRegistered,
  SessionUnregistered,
} from '../types/dashboard-events.js';

export type { AgentTier, AgentStatus } from '../types/agent.js';
export type { MeetingPhase } from '../types/meeting.js';

import type { DashboardEvent, AgentEvent } from '../types/dashboard-events.js';

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serialize a DashboardEvent to a JSON string for WebSocket transmission.
 */
export function serializeEvent(event: DashboardEvent): string {
  return JSON.stringify(event);
}

/**
 * Deserialize a JSON string back to a DashboardEvent.
 * Returns null if parsing fails.
 */
export function deserializeEvent(raw: string): DashboardEvent | null {
  try {
    return JSON.parse(raw) as DashboardEvent;
  } catch {
    return null;
  }
}

/**
 * Create a human-readable summary of an AgentEvent for logging.
 */
export function summarizeEvent(event: AgentEvent): string {
  switch (event.kind) {
    case 'agent_spawned':
      return `[SPAWN] ${event.label} (${event.agentType}) in ${event.department}`;
    case 'agent_destroyed':
      return `[DESTROY] ${event.agentId}`;
    case 'state_changed':
      return `[STATE] ${event.agentId}: ${event.from} -> ${event.to}`;
    case 'task_assigned':
      return `[TASK] ${event.agentId}: ${event.taskSummary}`;
    case 'task_completed':
      return `[DONE] ${event.agentId}: ${event.result}`;
    case 'message_sent':
      return `[MSG] ${event.fromId} -> ${event.toId}: ${event.summary}`;
    case 'mention_created':
      return `[@MENTION] ${event.summary} (${event.urgency})`;
    case 'mention_resolved':
      return `[@RESOLVED] ${event.mentionId}: ${event.decision}`;
    case 'cost_update':
      return `[COST] Total: $${event.totalCost.toFixed(4)}`;
  }
}
