import { EventEmitter } from 'node:events';
import type { AgentEvent } from '../types/index.js';

// ---------------------------------------------------------------------------
// Typed event map
// ---------------------------------------------------------------------------

/**
 * Events emitted by the internal event bus. The state bridge subscribes to
 * `agent_event` and forwards it to connected dashboard clients (rewrapped as
 * session-delta or session-snapshot on the wire).
 */
export interface EventBusEvents {
  agent_event: [event: AgentEvent];
}

// ---------------------------------------------------------------------------
// EventBus class
// ---------------------------------------------------------------------------

class EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emitAgentEvent(event: AgentEvent): void {
    this.emitter.emit('agent_event', event);
  }

  on<K extends keyof EventBusEvents>(event: K, listener: (...args: EventBusEvents[K]) => void): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof EventBusEvents>(event: K, listener: (...args: EventBusEvents[K]) => void): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  once<K extends keyof EventBusEvents>(event: K, listener: (...args: EventBusEvents[K]) => void): void {
    this.emitter.once(event, listener as (...args: unknown[]) => void);
  }

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

/** Global event bus singleton for internal inter-agent communication. */
export const eventBus = new EventBus();
