/**
 * Tests for `announce-plan-state` MCP tool: mirrors Claude Code plan-mode
 * lifecycle to the dashboard via emitted `plan_state` events.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { announcePlanStateHandler } from '../../src/tools/announce-plan-state.js';
import { eventBus } from '../../src/orchestrator/event-bus.js';

afterEach(() => {
  eventBus.removeAllListeners('agent_event');
});

function captureOne(): Promise<any> {
  return new Promise((resolve) => {
    eventBus.once('agent_event', (e) => resolve(e));
  });
}

describe('announce-plan-state handler', () => {
  it('rejects entered without cycle', async () => {
    const r = await announcePlanStateHandler({ phase: 'entered' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/cycle/);
  });

  it('rejects clarify-asked without questions', async () => {
    const r = await announcePlanStateHandler({ phase: 'clarify-asked' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/questions/);
  });

  it('rejects plan-presented without plan', async () => {
    const r = await announcePlanStateHandler({ phase: 'plan-presented' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/plan/);
  });

  it('rejects resolved without outcome', async () => {
    const r = await announcePlanStateHandler({ phase: 'resolved' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/outcome/);
  });

  it('rejects resolved=rejected without feedback', async () => {
    const r = await announcePlanStateHandler({ phase: 'resolved', outcome: 'rejected' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/feedback/);
  });

  it('emits plan_state on entered', async () => {
    const captured = captureOne();
    const r = await announcePlanStateHandler({ phase: 'entered', cycle: 'kickoff' });
    expect(r.isError).toBeUndefined();
    const e = await captured;
    expect(e.kind).toBe('plan_state');
    expect(e.phase).toBe('entered');
    expect(e.cycle).toBe('kickoff');
  });

  it('emits plan_state on clarify-asked with questions', async () => {
    const captured = captureOne();
    const r = await announcePlanStateHandler({
      phase: 'clarify-asked',
      questions: [
        { id: 'q1', question: 'Users?', options: ['personal', 'team', '다른 의견'] },
      ],
    });
    expect(r.isError).toBeUndefined();
    const e = await captured;
    expect(e.phase).toBe('clarify-asked');
    expect(e.questions).toHaveLength(1);
    expect(e.questions[0].options).toContain('다른 의견');
  });

  it('emits plan_state on plan-presented with plan text', async () => {
    const captured = captureOne();
    const r = await announcePlanStateHandler({
      phase: 'plan-presented',
      plan: 'Build X. Files: a.ts, b.ts. Tasks: 1) ... 2) ...',
    });
    expect(r.isError).toBeUndefined();
    const e = await captured;
    expect(e.phase).toBe('plan-presented');
    expect(e.plan).toMatch(/Build X/);
  });

  it('emits plan_state on resolved with outcome', async () => {
    const captured = captureOne();
    const r = await announcePlanStateHandler({ phase: 'resolved', outcome: 'auto-accept' });
    expect(r.isError).toBeUndefined();
    const e = await captured;
    expect(e.phase).toBe('resolved');
    expect(e.outcome).toBe('auto-accept');
  });

  it('accepts resolved=rejected with feedback', async () => {
    const r = await announcePlanStateHandler({
      phase: 'resolved',
      outcome: 'rejected',
      feedback: 'use zustand instead of redux',
    });
    expect(r.isError).toBeUndefined();
  });
});
