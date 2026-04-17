import { describe, it, expect } from 'vitest';
import { isValidParent, getTierConfig } from '../../src/agents/tiers.js';

describe('isValidParent', () => {
  it('allows orchestrator -> leader', () => {
    expect(isValidParent('orchestrator', 'leader')).toBe(true);
  });

  it('allows leader -> worker', () => {
    expect(isValidParent('leader', 'worker')).toBe(true);
  });

  it('rejects worker -> leader (reverse direction)', () => {
    expect(isValidParent('worker', 'leader')).toBe(false);
  });

  it('rejects orchestrator -> worker (skip tier)', () => {
    expect(isValidParent('orchestrator', 'worker')).toBe(false);
  });

  it('rejects same-tier spawning', () => {
    expect(isValidParent('leader', 'leader')).toBe(false);
    expect(isValidParent('worker', 'worker')).toBe(false);
    expect(isValidParent('orchestrator', 'orchestrator')).toBe(false);
  });

  it('rejects worker -> orchestrator', () => {
    expect(isValidParent('worker', 'orchestrator')).toBe(false);
  });
});

describe('getTierConfig', () => {
  it('returns orchestrator config with maxTurns (model inherited)', () => {
    const config = getTierConfig('orchestrator');
    expect(config.model).toBeUndefined();
    expect(config.maxTurns).toBe(10);
  });

  it('returns leader config', () => {
    const config = getTierConfig('leader');
    expect(config.model).toBeUndefined();
    expect(config.maxTurns).toBe(20);
  });

  it('returns worker config', () => {
    const config = getTierConfig('worker');
    expect(config.model).toBeUndefined();
    expect(config.maxTurns).toBe(30);
  });

  it('returns a copy (not the shared object)', () => {
    const a = getTierConfig('orchestrator');
    const b = getTierConfig('orchestrator');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('throws for unknown tier', () => {
    // @ts-expect-error testing invalid input
    expect(() => getTierConfig('unknown')).toThrow('Unknown agent tier');
  });
});
