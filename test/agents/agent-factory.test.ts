import { describe, it, expect } from 'vitest';
import { createAgentConfig, getOrchestratorSystemPrompt } from '../../src/agents/agent-factory.js';

describe('createAgentConfig', () => {
  describe('orchestrator tier', () => {
    it('returns config with orchestrator turn budget (model inherited)', () => {
      const config = createAgentConfig({
        tier: 'orchestrator',
        role: 'orchestrator',
        department: 'architecture',
      });
      expect(config.model).toBeUndefined();
      expect(config.maxTurns).toBe(10);
    });

    it('includes department tools in allowedTools', () => {
      const config = createAgentConfig({
        tier: 'orchestrator',
        role: 'orchestrator',
        department: 'architecture',
      });
      expect(config.allowedTools).toContain('Read');
      expect(config.allowedTools).toContain('Grep');
      expect(config.allowedTools).toContain('Glob');
    });
  });

  describe('leader tier', () => {
    it('returns leader-tier turn budget and department tools', () => {
      const config = createAgentConfig({
        tier: 'leader',
        role: 'engineer',
        department: 'engineering',
      });
      expect(config.model).toBeUndefined();
      expect(config.maxTurns).toBe(20);

      expect(config.allowedTools).toContain('Write');
      expect(config.allowedTools).toContain('Edit');
      expect(config.allowedTools).toContain('Bash');
    });
  });

  describe('worker tier', () => {
    it('returns worker-tier turn budget', () => {
      const config = createAgentConfig({
        tier: 'worker',
        role: 'feature-dev',
        department: 'engineering',
        task: 'Implement the login form',
      });
      expect(config.model).toBeUndefined();
      expect(config.maxTurns).toBe(30);

      expect(config.allowedTools).toContain('Write');
    });

    it('throws if task is missing', () => {
      expect(() =>
        createAgentConfig({
          tier: 'worker',
          role: 'feature-dev',
          department: 'engineering',
        }),
      ).toThrow('Worker agents require a task description');
    });

    it('does not special-case research workers (model still inherits)', () => {
      const config = createAgentConfig({
        tier: 'worker',
        role: 'code-explorer',
        department: 'research',
        task: 'Explore the authentication module',
      });
      expect(config.model).toBeUndefined();
    });
  });
});

describe('getOrchestratorSystemPrompt', () => {
  it('returns a non-empty string containing orchestrator identity', () => {
    const prompt = getOrchestratorSystemPrompt();
    expect(prompt).toContain('Orchestrator');
    expect(prompt).toContain('CONVENE_MEETING');
    expect(prompt).toContain('DIRECT_ROUTE');
  });
});
