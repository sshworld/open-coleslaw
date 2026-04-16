/**
 * StateBridge — manages per-session state and emits 'broadcast' events
 * for the dashboard server to relay to browser WebSocket clients.
 *
 * Supports multiple sessions (one per MCP server instance).  Each session
 * tracks its own agent graph independently.  Disconnected sessions are kept
 * (grayed-out tab) rather than deleted.
 */

import { EventEmitter } from 'node:events';
import type {
  AgentState,
  EdgeState,
  MeetingState,
  AgentEvent,
  MultiSessionSnapshot,
  SessionDelta,
} from '../types/dashboard-events.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Per-session state container
// ---------------------------------------------------------------------------

interface SessionState {
  projectName: string;
  displayName: string;
  projectPath: string;
  isActive: boolean;
  agents: Map<string, AgentState>;
  edges: EdgeState[];
  meeting: MeetingState | null;
  totalCost: number;
  eventLog: Array<{ timestamp: number; event: AgentEvent }>;
}

// ---------------------------------------------------------------------------
// StateBridge
// ---------------------------------------------------------------------------

export class StateBridge extends EventEmitter {
  private sessions = new Map<string, SessionState>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private pendingEvents = new Map<string, AgentEvent[]>();

  // -----------------------------------------------------------------------
  // Session lifecycle
  // -----------------------------------------------------------------------

  registerSession(info: {
    sessionId: string;
    projectPath: string;
    projectName: string;
  }): string {
    const displayName = this.getUniqueDisplayName(info.projectName);

    this.sessions.set(info.sessionId, {
      projectName: info.projectName,
      displayName,
      projectPath: info.projectPath,
      isActive: true,
      agents: new Map(),
      edges: [],
      meeting: null,
      totalCost: 0,
      eventLog: [],
    });

    logger.info(`Session registered: ${displayName} (${info.sessionId})`);

    // Notify browser clients about the new session
    this.emit(
      'broadcast',
      JSON.stringify({
        type: 'session-registered',
        sessionId: info.sessionId,
        displayName,
        projectPath: info.projectPath,
      }),
    );

    return displayName;
  }

  unregisterSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      logger.info(`Session deactivated: ${session.displayName}`);

      // Don't delete — keep for display (grayed-out tab)
      this.emit(
        'broadcast',
        JSON.stringify({
          type: 'session-unregistered',
          sessionId,
        }),
      );
    }
  }

  // -----------------------------------------------------------------------
  // Event handling
  // -----------------------------------------------------------------------

  handleSessionEvent(sessionId: string, event: AgentEvent): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Apply event to session state
    this.applyEvent(session, event);

    // Queue for debounced broadcast
    if (!this.pendingEvents.has(sessionId)) {
      this.pendingEvents.set(sessionId, []);
    }
    this.pendingEvents.get(sessionId)!.push(event);

    // Debounce broadcast per session (100ms)
    if (!this.debounceTimers.has(sessionId)) {
      this.debounceTimers.set(
        sessionId,
        setTimeout(() => {
          this.flushEvents(sessionId);
          this.debounceTimers.delete(sessionId);
        }, 100),
      );
    }
  }

  // -----------------------------------------------------------------------
  // Snapshot (sent to newly connected browser clients)
  // -----------------------------------------------------------------------

  getSnapshot(): MultiSessionSnapshot {
    return {
      type: 'multi-snapshot',
      sessions: Array.from(this.sessions.entries()).map(([sessionId, s]) => ({
        sessionId,
        displayName: s.displayName,
        projectPath: s.projectPath,
        isActive: s.isActive,
        snapshot: {
          agents: Array.from(s.agents.values()),
          edges: [...s.edges],
          meeting: s.meeting,
          totalCost: s.totalCost,
        },
      })),
    };
  }

  // -----------------------------------------------------------------------
  // Private — unique display name
  // -----------------------------------------------------------------------

  private getUniqueDisplayName(projectName: string): string {
    const existing = Array.from(this.sessions.values()).map(
      (s) => s.displayName,
    );
    if (!existing.includes(projectName)) return projectName;
    let i = 1;
    while (existing.includes(`${projectName} (${i})`)) i++;
    return `${projectName} (${i})`;
  }

  // -----------------------------------------------------------------------
  // Private — state mutations (scoped to a session)
  // -----------------------------------------------------------------------

  private applyEvent(session: SessionState, event: AgentEvent): void {
    session.eventLog.push({ timestamp: Date.now(), event });
    // Keep log bounded
    if (session.eventLog.length > 500) session.eventLog.shift();

    switch (event.kind) {
      case 'agent_spawned': {
        const agent: AgentState = {
          id: event.agentId,
          type: event.agentType,
          label: event.label,
          status: 'idle',
          parentId: event.parentId,
          department: event.department,
          currentTask: null,
          costUsd: 0,
        };
        session.agents.set(event.agentId, agent);

        if (event.parentId) {
          session.edges.push({
            id: `edge-${event.parentId}-${event.agentId}`,
            source: event.parentId,
            target: event.agentId,
            edgeType: 'hierarchy',
            active: true,
            label: '',
          });
        }
        break;
      }

      case 'agent_destroyed': {
        session.agents.delete(event.agentId);
        session.edges = session.edges.filter(
          (e) => e.source !== event.agentId && e.target !== event.agentId,
        );
        break;
      }

      case 'state_changed': {
        const a = session.agents.get(event.agentId);
        if (a) a.status = event.to;
        break;
      }

      case 'task_assigned': {
        const a = session.agents.get(event.agentId);
        if (a) {
          a.currentTask = event.taskSummary;
          a.status = 'working';
        }
        break;
      }

      case 'task_completed': {
        const a = session.agents.get(event.agentId);
        if (a) {
          a.currentTask = null;
          a.status = event.result === 'success' ? 'completed' : 'failed';
        }
        break;
      }

      case 'message_sent': {
        const edgeId = `msg-${event.fromId}-${event.toId}-${Date.now()}`;
        session.edges.push({
          id: edgeId,
          source: event.fromId,
          target: event.toId,
          edgeType: 'message',
          active: true,
          label: event.summary,
        });
        // Remove transient message edges after 5 seconds
        setTimeout(() => {
          session.edges = session.edges.filter((e) => e.id !== edgeId);
        }, 5_000);
        break;
      }

      case 'mention_created':
      case 'mention_resolved':
        // Logged but don't mutate the agent graph.
        break;

      case 'cost_update': {
        session.totalCost = event.totalCost;
        break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private — flush debounced events
  // -----------------------------------------------------------------------

  private flushEvents(sessionId: string): void {
    const events = this.pendingEvents.get(sessionId);
    const session = this.sessions.get(sessionId);
    if (!events || !session || events.length === 0) return;

    const delta: SessionDelta = {
      type: 'session-delta',
      sessionId,
      displayName: session.displayName,
      timestamp: Date.now(),
      events: [...events],
    };

    this.emit('broadcast', JSON.stringify(delta));
    this.pendingEvents.set(sessionId, []);
  }
}
