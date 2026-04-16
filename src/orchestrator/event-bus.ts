import { EventEmitter } from 'node:events';
import type { AgentEvent, DashboardEvent } from '../types/index.js';

// ---------------------------------------------------------------------------
// Typed event map
// ---------------------------------------------------------------------------

/**
 * Events emitted by the internal event bus.
 *
 * - `agent_event`    — individual agent lifecycle events (spawned, destroyed, state change, etc.)
 * - `dashboard`      — full dashboard payloads (snapshot or delta) intended for the WebSocket dashboard.
 */
export interface EventBusEvents {
  agent_event: [event: AgentEvent];
  dashboard: [event: DashboardEvent];
}

// ---------------------------------------------------------------------------
// EventBus class
// ---------------------------------------------------------------------------

class EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Allow a reasonable number of listeners (leaders + dashboard + internal consumers)
    this.emitter.setMaxListeners(50);
  }

  // ---- emit ---------------------------------------------------------------

  /**
   * Emit a single agent lifecycle event.
   *
   * The event is:
   * 1. Broadcast to all `agent_event` listeners.
   * 2. Wrapped in a `delta` dashboard event and broadcast to `dashboard` listeners.
   * 3. (Planned) Persisted to SQLite via the storage layer.
   */
  emitAgentEvent(event: AgentEvent): void {
    this.emitter.emit('agent_event', event);

    // Wrap in a delta for the dashboard
    const delta: DashboardEvent = {
      type: 'delta',
      timestamp: Date.now(),
      events: [event],
    };
    this.emitter.emit('dashboard', delta);

    // TODO: persist to SQLite once the storage layer is implemented
    // import { eventStore } from '../storage/event-store.js';
    // eventStore.persist(event);
  }

  /**
   * Emit a full dashboard snapshot (used on initial WebSocket connection).
   */
  emitDashboardSnapshot(snapshot: DashboardEvent): void {
    this.emitter.emit('dashboard', snapshot);
  }

  // ---- subscribe ----------------------------------------------------------

  on<K extends keyof EventBusEvents>(event: K, listener: (...args: EventBusEvents[K]) => void): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof EventBusEvents>(event: K, listener: (...args: EventBusEvents[K]) => void): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  once<K extends keyof EventBusEvents>(event: K, listener: (...args: EventBusEvents[K]) => void): void {
    this.emitter.once(event, listener as (...args: unknown[]) => void);
  }

  // ---- utility ------------------------------------------------------------

  removeAllListeners(event?: keyof EventBusEvents): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  listenerCount(event: keyof EventBusEvents): number {
    return this.emitter.listenerCount(event);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/** Global event bus singleton for internal inter-agent communication. */
export const eventBus = new EventBus();
