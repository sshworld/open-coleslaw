import { describe, it, expect } from 'vitest';
import {
  TIER_CONFIGS,
  DEPARTMENT_TOOLS,
} from '../../src/types/agent.js';
import { DEFAULT_MEETING_CONFIG } from '../../src/types/meeting.js';

describe('type constants', () => {
  describe('TIER_CONFIGS', () => {
    it('should have all 3 tiers defined', () => {
      expect(TIER_CONFIGS).toHaveProperty('orchestrator');
      expect(TIER_CONFIGS).toHaveProperty('leader');
      expect(TIER_CONFIGS).toHaveProperty('worker');
      expect(Object.keys(TIER_CONFIGS)).toHaveLength(3);
    });

    it('should have a model string for each tier', () => {
      for (const tier of ['orchestrator', 'leader', 'worker'] as const) {
        expect(TIER_CONFIGS[tier].model).toBeTypeOf('string');
        expect(TIER_CONFIGS[tier].model.length).toBeGreaterThan(0);
      }
    });

    it('should have positive maxTurns for each tier', () => {
      for (const tier of ['orchestrator', 'leader', 'worker'] as const) {
        expect(TIER_CONFIGS[tier].maxTurns).toBeTypeOf('number');
        expect(TIER_CONFIGS[tier].maxTurns).toBeGreaterThan(0);
      }
    });

    it('should give leaders more turns than orchestrators', () => {
      expect(TIER_CONFIGS.leader.maxTurns).toBeGreaterThan(TIER_CONFIGS.orchestrator.maxTurns);
    });

    it('should give workers the most turns', () => {
      expect(TIER_CONFIGS.worker.maxTurns).toBeGreaterThan(TIER_CONFIGS.leader.maxTurns);
    });
  });

  describe('DEPARTMENT_TOOLS', () => {
    it('should have all 6 departments defined', () => {
      expect(DEPARTMENT_TOOLS).toHaveProperty('planning');
      expect(DEPARTMENT_TOOLS).toHaveProperty('architecture');
      expect(DEPARTMENT_TOOLS).toHaveProperty('engineering');
      expect(DEPARTMENT_TOOLS).toHaveProperty('verification');
      expect(DEPARTMENT_TOOLS).toHaveProperty('product');
      expect(DEPARTMENT_TOOLS).toHaveProperty('research');
      expect(Object.keys(DEPARTMENT_TOOLS)).toHaveLength(6);
    });

    it('should have non-empty tool arrays for each department', () => {
      for (const dept of Object.keys(DEPARTMENT_TOOLS) as Array<keyof typeof DEPARTMENT_TOOLS>) {
        expect(Array.isArray(DEPARTMENT_TOOLS[dept])).toBe(true);
        expect(DEPARTMENT_TOOLS[dept].length).toBeGreaterThan(0);
      }
    });

    it('should give every department at least the Read tool', () => {
      for (const dept of Object.keys(DEPARTMENT_TOOLS) as Array<keyof typeof DEPARTMENT_TOOLS>) {
        expect(DEPARTMENT_TOOLS[dept]).toContain('Read');
      }
    });

    it('should give engineering the most tools (including Write and Edit)', () => {
      expect(DEPARTMENT_TOOLS.engineering).toContain('Write');
      expect(DEPARTMENT_TOOLS.engineering).toContain('Edit');
      expect(DEPARTMENT_TOOLS.engineering).toContain('Bash');
    });

    it('should give verification the Bash tool for test running', () => {
      expect(DEPARTMENT_TOOLS.verification).toContain('Bash');
    });

    it('should give research the WebSearch tool', () => {
      expect(DEPARTMENT_TOOLS.research).toContain('WebSearch');
    });
  });

  describe('DEFAULT_MEETING_CONFIG', () => {
    it('should exist and be an object', () => {
      expect(DEFAULT_MEETING_CONFIG).toBeDefined();
      expect(typeof DEFAULT_MEETING_CONFIG).toBe('object');
    });

    it('should have a positive maxRoundsPerItem', () => {
      expect(DEFAULT_MEETING_CONFIG.maxRoundsPerItem).toBeTypeOf('number');
      expect(DEFAULT_MEETING_CONFIG.maxRoundsPerItem).toBeGreaterThan(0);
    });

    it('should have a convergenceThreshold between 0 and 1', () => {
      expect(DEFAULT_MEETING_CONFIG.convergenceThreshold).toBeTypeOf('number');
      expect(DEFAULT_MEETING_CONFIG.convergenceThreshold).toBeGreaterThan(0);
      expect(DEFAULT_MEETING_CONFIG.convergenceThreshold).toBeLessThanOrEqual(1);
    });

    it('should have a model string', () => {
      expect(DEFAULT_MEETING_CONFIG.model).toBeTypeOf('string');
      expect(DEFAULT_MEETING_CONFIG.model.length).toBeGreaterThan(0);
    });
  });
});
