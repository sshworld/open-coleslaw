/**
 * Tests for src/dashboard/events.ts and src/dashboard/state-bridge.ts
 *
 * The StateBridge wires to the global eventBus and a WebSocketServer. We
 * provide a minimal mock WSS so that the constructor succeeds without starting
 * a real server.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { DashboardEvent, AgentEvent } from '../../src/types/dashboard-events.js';

// ---------------------------------------------------------------------------
// Import serialisation helpers (pure functions — no mocking needed)
// ---------------------------------------------------------------------------

const {
  serializeEvent,
  deserializeEvent,
  summarizeEvent,
} = await import('../../src/dashboard/events.js');

// ---------------------------------------------------------------------------
// Import StateBridge (requires eventBus, but it's a singleton — fine in test)
// ---------------------------------------------------------------------------

const { StateBridge } = await import('../../src/dashboard/state-bridge.js');

// ---------------------------------------------------------------------------
// Tests — events.ts helpers
// ---------------------------------------------------------------------------

describe('serializeEvent / deserializeEvent', () => {
  it('round-trips a snapshot event', () => {
    const snapshot: DashboardEvent = {
      type: 'snapshot',
      agents: [],
      edges: [],
      meeting: null,
    };

    const json = serializeEvent(snapshot);
    expect(typeof json).toBe('string');

    const parsed = deserializeEvent(json);
    expect(parsed).toEqual(snapshot);
  });

  it('round-trips a delta event', () => {
    const delta: DashboardEvent = {
      type: 'delta',
      timestamp: Date.now(),
      events: [
        {
          kind: 'cost_update',
          totalCost: 1.23,
        },
      ],
    };

    const json = serializeEvent(delta);
    const parsed = deserializeEvent(json);
    expect(parsed).toEqual(delta);
  });

  it('deserializeEvent returns null for invalid JSON', () => {
    expect(deserializeEvent('not-json')).toBeNull();
    expect(deserializeEvent('')).toBeNull();
  });
});

describe('summarizeEvent', () => {
  it('summarises agent_spawned', () => {
    const event: AgentEvent = {
      kind: 'agent_spawned',
      agentId: 'a1',
      agentType: 'leader',
      parentId: null,
      label: 'engineer',
      department: 'engineering',
    };
    const summary = summarizeEvent(event);
    expect(summary).toContain('[SPAWN]');
    expect(summary).toContain('engineer');
    expect(summary).toContain('engineering');
  });

  it('summarises agent_destroyed', () => {
    const event: AgentEvent = { kind: 'agent_destroyed', agentId: 'a1' };
    expect(summarizeEvent(event)).toContain('[DESTROY]');
  });

  it('summarises state_changed', () => {
    const event: AgentEvent = {
      kind: 'state_changed',
      agentId: 'a1',
      from: 'idle',
      to: 'working',
    };
    const s = summarizeEvent(event);
    expect(s).toContain('[STATE]');
    expect(s).toContain('idle');
    expect(s).toContain('working');
  });

  it('summarises task_assigned', () => {
    const event: AgentEvent = {
      kind: 'task_assigned',
      agentId: 'a1',
      taskSummary: 'Build API',
    };
    expect(summarizeEvent(event)).toContain('[TASK]');
    expect(summarizeEvent(event)).toContain('Build API');
  });

  it('summarises task_completed', () => {
    const event: AgentEvent = {
      kind: 'task_completed',
      agentId: 'a1',
      result: 'success',
    };
    expect(summarizeEvent(event)).toContain('[DONE]');
  });

  it('summarises message_sent', () => {
    const event: AgentEvent = {
      kind: 'message_sent',
      fromId: 'a1',
      toId: 'a2',
      summary: 'Hello',
    };
    const s = summarizeEvent(event);
    expect(s).toContain('[MSG]');
    expect(s).toContain('Hello');
  });

  it('summarises mention_created', () => {
    const event: AgentEvent = {
      kind: 'mention_created',
      mentionId: 'm1',
      summary: 'Need decision',
      urgency: 'blocking',
    };
    const s = summarizeEvent(event);
    expect(s).toContain('[@MENTION]');
    expect(s).toContain('blocking');
  });

  it('summarises mention_resolved', () => {
    const event: AgentEvent = {
      kind: 'mention_resolved',
      mentionId: 'm1',
      decision: 'Go with REST',
    };
    const s = summarizeEvent(event);
    expect(s).toContain('[@RESOLVED]');
    expect(s).toContain('Go with REST');
  });

  it('summarises cost_update', () => {
    const event: AgentEvent = { kind: 'cost_update', totalCost: 0.0042 };
    const s = summarizeEvent(event);
    expect(s).toContain('[COST]');
    expect(s).toContain('0.0042');
  });
});

// ---------------------------------------------------------------------------
// Tests — StateBridge
// ---------------------------------------------------------------------------

describe('StateBridge', () => {
  let bridge: InstanceType<typeof StateBridge>;

  beforeEach(() => {
    // Minimal mock of WebSocketServer that satisfies the constructor.
    const mockWss = {
      clients: new Set(),
      on: vi.fn(),
    } as any;

    bridge = new StateBridge(mockWss);
  });

  it('constructs without error', () => {
    expect(bridge).toBeDefined();
  });

  it('getSnapshot returns a MultiSessionSnapshot', () => {
    const snap = bridge.getSnapshot();

    expect(snap.type).toBe('multi-snapshot');
    expect(Array.isArray(snap.sessions)).toBe(true);
    expect(snap.sessions).toHaveLength(0);
  });

  it('getSnapshot is serialisable via serializeEvent', () => {
    const snap = bridge.getSnapshot();
    const json = serializeEvent(snap);
    const parsed = deserializeEvent(json);
    expect(parsed).toEqual(snap);
  });
});
