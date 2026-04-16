/**
 * StateBridge — bridges the orchestrator event bus to WebSocket broadcasts.
 *
 * Maintains an in-memory view of the full agent graph and pushes snapshots /
 * deltas to every connected WebSocket client.
 */

import type { WebSocketServer, WebSocket } from 'ws';
import { eventBus } from '../orchestrator/event-bus.js';
import { serializeEvent } from './events.js';
import type {
  AgentState,
  EdgeState,
  MeetingState,
  DashboardEvent,
  AgentEvent,
} from '../types/dashboard-events.js';

// ---------------------------------------------------------------------------
// StateBridge
// ---------------------------------------------------------------------------

export class StateBridge {
  private agents = new Map<string, AgentState>();
  private edges: EdgeState[] = [];
  private meeting: MeetingState | null = null;
  private totalCost = 0;

  private wss: WebSocketServer;

  /** Pending events accumulated during the debounce window. */
  private pendingEvents: AgentEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  /** Debounce window in ms. */
  private static readonly DEBOUNCE_MS = 100;

  constructor(wss: WebSocketServer) {
    this.wss = wss;

    // Subscribe to every agent event coming through the event bus.
    eventBus.on('agent_event', (event: AgentEvent) => {
      this.handleEvent(event);
    });
  }

  // -----------------------------------------------------------------------
  // Public
  // -----------------------------------------------------------------------

  /**
   * Return a full snapshot of the current state — used when a new client connects.
   */
  getSnapshot(): DashboardEvent {
    return {
      type: 'snapshot',
      agents: Array.from(this.agents.values()),
      edges: [...this.edges],
      meeting: this.meeting,
    };
  }

  // -----------------------------------------------------------------------
  // Private — event handling
  // -----------------------------------------------------------------------

  private handleEvent(event: AgentEvent): void {
    // 1. Update the in-memory state.
    this.applyEvent(event);

    // 2. Queue the event and schedule a debounced broadcast.
    this.pendingEvents.push(event);

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, StateBridge.DEBOUNCE_MS);
    }
  }

  private flush(): void {
    this.flushTimer = null;

    if (this.pendingEvents.length === 0) return;

    const delta: DashboardEvent = {
      type: 'delta',
      timestamp: Date.now(),
      events: [...this.pendingEvents],
    };
    this.pendingEvents = [];
    this.broadcast(delta);
  }

  // -----------------------------------------------------------------------
  // Private — state mutations
  // -----------------------------------------------------------------------

  private applyEvent(event: AgentEvent): void {
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
        this.agents.set(event.agentId, agent);

        // Create a hierarchy edge if the agent has a parent.
        if (event.parentId) {
          this.edges.push({
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
        this.agents.delete(event.agentId);
        this.edges = this.edges.filter(
          (e) => e.source !== event.agentId && e.target !== event.agentId,
        );
        break;
      }

      case 'state_changed': {
        const a = this.agents.get(event.agentId);
        if (a) a.status = event.to;
        break;
      }

      case 'task_assigned': {
        const a = this.agents.get(event.agentId);
        if (a) {
          a.currentTask = event.taskSummary;
          a.status = 'working';
        }
        break;
      }

      case 'task_completed': {
        const a = this.agents.get(event.agentId);
        if (a) {
          a.currentTask = null;
          a.status = event.result === 'success' ? 'completed' : 'failed';
        }
        break;
      }

      case 'message_sent': {
        // Add a transient message edge.
        const edgeId = `msg-${event.fromId}-${event.toId}-${Date.now()}`;
        this.edges.push({
          id: edgeId,
          source: event.fromId,
          target: event.toId,
          edgeType: 'message',
          active: true,
          label: event.summary,
        });
        // Remove after 5 seconds so the graph doesn't get cluttered.
        setTimeout(() => {
          this.edges = this.edges.filter((e) => e.id !== edgeId);
        }, 5_000);
        break;
      }

      case 'mention_created': {
        // Mentions are logged but don't change the agent graph directly.
        break;
      }

      case 'mention_resolved': {
        break;
      }

      case 'cost_update': {
        this.totalCost = event.totalCost;
        break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private — broadcast
  // -----------------------------------------------------------------------

  private broadcast(event: DashboardEvent): void {
    const data = serializeEvent(event);

    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === 1 /* WebSocket.OPEN */) {
        client.send(data);
      }
    });
  }
}
