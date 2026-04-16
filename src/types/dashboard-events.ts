import type { AgentStatus, AgentTier } from './agent.js';
import type { MeetingPhase } from './meeting.js';

export interface AgentState {
  id: string;
  type: AgentTier;
  label: string;
  status: AgentStatus;
  parentId: string | null;
  department: string;
  currentTask: string | null;
  costUsd: number;
}

export interface EdgeState {
  id: string;
  source: string;
  target: string;
  edgeType: 'hierarchy' | 'delegation' | 'report' | 'message' | 'mention';
  active: boolean;
  label: string;
}

export interface MeetingState {
  meetingId: string;
  phase: MeetingPhase;
  participants: string[];
  startedAt: number;
}

export type DashboardEvent =
  | { type: 'snapshot'; agents: AgentState[]; edges: EdgeState[]; meeting: MeetingState | null }
  | { type: 'delta'; timestamp: number; events: AgentEvent[] };

export type AgentEvent =
  | { kind: 'agent_spawned'; agentId: string; agentType: AgentTier; parentId: string | null; label: string; department: string }
  | { kind: 'agent_destroyed'; agentId: string }
  | { kind: 'state_changed'; agentId: string; from: AgentStatus; to: AgentStatus }
  | { kind: 'task_assigned'; agentId: string; taskSummary: string }
  | { kind: 'task_completed'; agentId: string; result: 'success' | 'failure' }
  | { kind: 'message_sent'; fromId: string; toId: string; summary: string }
  | { kind: 'mention_created'; mentionId: string; summary: string; urgency: 'blocking' | 'advisory' }
  | { kind: 'mention_resolved'; mentionId: string; decision: string }
  | { kind: 'cost_update'; totalCost: number };

// ---------------------------------------------------------------------------
// Multi-session types
// ---------------------------------------------------------------------------

export interface ProjectSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  displayName: string;
  isActive: boolean;
}

export interface RegisterMessage {
  type: 'register';
  sessionId: string;
  projectPath: string;
  projectName: string;
}

export interface SessionEventMessage {
  type: 'session-event';
  sessionId: string;
  event: AgentEvent;
}

export interface UnregisterMessage {
  type: 'unregister';
  sessionId: string;
}

export type ServerMessage = RegisterMessage | SessionEventMessage | UnregisterMessage;

export interface MultiSessionSnapshot {
  type: 'multi-snapshot';
  sessions: Array<{
    sessionId: string;
    displayName: string;
    projectPath: string;
    isActive: boolean;
    snapshot: {
      agents: AgentState[];
      edges: EdgeState[];
      meeting: MeetingState | null;
      totalCost: number;
    };
  }>;
}

export interface SessionDelta {
  type: 'session-delta';
  sessionId: string;
  displayName: string;
  timestamp: number;
  events: AgentEvent[];
}

export interface SessionRegistered {
  type: 'session-registered';
  sessionId: string;
  displayName: string;
  projectPath: string;
}

export interface SessionUnregistered {
  type: 'session-unregistered';
  sessionId: string;
}
