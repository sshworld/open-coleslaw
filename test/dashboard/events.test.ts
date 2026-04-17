/**
 * Tests for src/dashboard/events.ts and src/dashboard/state-bridge.ts
 *
 * The dashboard now models meetings as threads of speaker comments, rather
 * than as an agent graph. Events are: meeting_started, transcript_added,
 * round_advanced, consensus_checked, minutes_finalized, user_comment_added,
 * mvp_progress, mention_{created,resolved}, cost_update.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  AgentEvent,
  MultiSessionSnapshot,
  ThreadComment,
} from '../../src/types/dashboard-events.js';

const {
  serializeEvent,
  deserializeEvent,
  summarizeEvent,
} = await import('../../src/dashboard/events.js');

const { StateBridge } = await import('../../src/dashboard/state-bridge.js');

// ---------------------------------------------------------------------------
// Tests — events.ts helpers
// ---------------------------------------------------------------------------

describe('serializeEvent / deserializeEvent', () => {
  it('round-trips a multi-session snapshot', () => {
    const snapshot: MultiSessionSnapshot = {
      type: 'multi-snapshot',
      sessions: [],
    };

    const json = serializeEvent(snapshot);
    expect(typeof json).toBe('string');

    const parsed = deserializeEvent(json);
    expect(parsed).toEqual(snapshot);
  });

  it('round-trips a session-registered event', () => {
    const registered = {
      type: 'session-registered' as const,
      sessionId: 's1',
      displayName: 'proj-a',
      projectPath: '/tmp/proj-a',
    };
    const json = serializeEvent(registered);
    const parsed = deserializeEvent(json);
    expect(parsed).toEqual(registered);
  });

  it('deserializeEvent returns null for invalid JSON', () => {
    expect(deserializeEvent('not-json')).toBeNull();
    expect(deserializeEvent('')).toBeNull();
  });
});

describe('summarizeEvent', () => {
  it('summarises meeting_started', () => {
    const event: AgentEvent = {
      kind: 'meeting_started',
      meetingId: 'm1',
      meetingType: 'design',
      topic: 'Add login',
      agenda: ['Provider'],
      participants: ['planner', 'engineer'],
    };
    const s = summarizeEvent(event);
    expect(s).toContain('[MEETING]');
    expect(s).toContain('Add login');
    expect(s).toContain('design');
  });

  it('summarises transcript_added', () => {
    const comment: ThreadComment = {
      id: 1,
      speakerRole: 'architect',
      agendaItemIndex: 0,
      roundNumber: 2,
      content: 'REST is fine',
      stance: 'speaking',
      createdAt: Date.now(),
    };
    const event: AgentEvent = {
      kind: 'transcript_added',
      meetingId: 'm1',
      comment,
    };
    const s = summarizeEvent(event);
    expect(s).toContain('[SPEAK]');
    expect(s).toContain('architect');
    expect(s).toContain('r2');
  });

  it('summarises consensus_checked (agreement)', () => {
    const event: AgentEvent = {
      kind: 'consensus_checked',
      meetingId: 'm1',
      allAgreed: true,
      stances: [],
    };
    expect(summarizeEvent(event)).toContain('all agreed');
  });

  it('summarises minutes_finalized', () => {
    const event: AgentEvent = {
      kind: 'minutes_finalized',
      meetingId: 'm1',
      decisions: ['Use REST', 'JWT for auth'],
      actionItems: ['Scaffold endpoints'],
    };
    expect(summarizeEvent(event)).toContain('2 decisions');
  });

  it('summarises user_comment_added', () => {
    const event: AgentEvent = {
      kind: 'user_comment_added',
      meetingId: 'm1',
      content: 'Can we also add refresh tokens?',
      source: 'browser',
    };
    const s = summarizeEvent(event);
    expect(s).toContain('[USER:browser]');
    expect(s).toContain('refresh tokens');
  });

  it('summarises mvp_progress', () => {
    const event: AgentEvent = {
      kind: 'mvp_progress',
      mvps: [
        { id: '1', title: 'A', goal: '', status: 'done', orderIndex: 0 },
        { id: '2', title: 'B', goal: '', status: 'pending', orderIndex: 1 },
      ],
    };
    expect(summarizeEvent(event)).toContain('1/2 done');
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
    bridge = new StateBridge();
  });

  it('constructs without error', () => {
    expect(bridge).toBeDefined();
  });

  it('getSnapshot returns an empty MultiSessionSnapshot', () => {
    const snap = bridge.getSnapshot();
    expect(snap.type).toBe('multi-snapshot');
    expect(Array.isArray(snap.sessions)).toBe(true);
    expect(snap.sessions).toHaveLength(0);
  });

  it('registerSession adds a session keyed by projectPath', () => {
    const displayName = bridge.registerSession({
      sessionId: 's1',
      projectPath: '/tmp/x',
      projectName: 'x',
    });
    expect(displayName).toBe('x');

    const snap = bridge.getSnapshot();
    expect(snap.sessions).toHaveLength(1);
    // Wire-side sessionId is the projectPath (stable across terminal reopens).
    expect(snap.sessions[0].sessionId).toBe('/tmp/x');
    expect(snap.sessions[0].projectPath).toBe('/tmp/x');
    expect(snap.sessions[0].currentMeeting).toBeNull();
  });

  it('re-registering the same projectPath does NOT create a duplicate "(1)" entry', () => {
    bridge.registerSession({ sessionId: 's1', projectPath: '/tmp/x', projectName: 'x' });
    const second = bridge.registerSession({
      sessionId: 's2',
      projectPath: '/tmp/x',
      projectName: 'x',
    });
    expect(second).toBe('x'); // no "(1)" suffix

    const snap = bridge.getSnapshot();
    expect(snap.sessions).toHaveLength(1);
  });

  it('meeting_started event installs a current meeting', () => {
    bridge.registerSession({ sessionId: 's1', projectPath: '/tmp/x', projectName: 'x' });
    bridge.handleSessionEvent('s1', {
      kind: 'meeting_started',
      meetingId: 'm1',
      meetingType: 'design',
      topic: 'T',
      agenda: ['A1'],
      participants: ['planner', 'engineer'],
    });
    const snap = bridge.getSnapshot();
    expect(snap.sessions[0].currentMeeting?.meetingId).toBe('m1');
    expect(snap.sessions[0].currentMeeting?.topic).toBe('T');
  });

  it('transcript_added appends to the thread', () => {
    bridge.registerSession({ sessionId: 's1', projectPath: '/tmp/x', projectName: 'x' });
    bridge.handleSessionEvent('s1', {
      kind: 'meeting_started',
      meetingId: 'm1',
      meetingType: 'design',
      topic: 'T',
      agenda: ['A1'],
      participants: ['planner'],
    });
    bridge.handleSessionEvent('s1', {
      kind: 'transcript_added',
      meetingId: 'm1',
      comment: {
        id: 1,
        speakerRole: 'planner',
        agendaItemIndex: 0,
        roundNumber: 1,
        content: 'Opening...',
        stance: 'speaking',
        createdAt: Date.now(),
      },
    });
    const snap = bridge.getSnapshot();
    expect(snap.sessions[0].currentMeeting?.comments).toHaveLength(1);
    expect(snap.sessions[0].currentMeeting?.comments[0].content).toBe('Opening...');
  });

  it('getSnapshot is serialisable via serializeEvent', () => {
    const snap = bridge.getSnapshot();
    const json = serializeEvent(snap);
    const parsed = deserializeEvent(json);
    expect(parsed).toEqual(snap);
  });
});
