import { describe, it, expect } from 'vitest';
import { createAgentConfig, getOrchestratorSystemPrompt } from '../../src/agents/agent-factory.js';

describe('createAgentConfig', () => {
  describe('orchestrator tier', () => {
    it('returns config with correct model and orchestrator system prompt reference', () => {
      const config = createAgentConfig({
        tier: 'orchestrator',
        role: 'orchestrator',
        department: 'architecture',
      });
      expect(config.model).toBe('claude-sonnet-4-6');
      expect(config.maxTurns).toBe(10);
      expect(config.maxBudgetUsd).toBe(1.0);
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
    it('returns config with leader-tier settings and department tools', () => {
      const config = createAgentConfig({
        tier: 'leader',
        role: 'eng-leader',
        department: 'engineering',
      });
      expect(config.model).toBe('claude-sonnet-4-6');
      expect(config.maxTurns).toBe(20);
      expect(config.maxBudgetUsd).toBe(2.0);
      expect(config.allowedTools).toContain('Write');
      expect(config.allowedTools).toContain('Edit');
      expect(config.allowedTools).toContain('Bash');
    });
  });

  describe('worker tier', () => {
    it('returns config with worker-tier settings', () => {
      const config = createAgentConfig({
        tier: 'worker',
        role: 'feature-dev',
        department: 'engineering',
        task: 'Implement the login form',
      });
      expect(config.model).toBe('claude-sonnet-4-6');
      expect(config.maxTurns).toBe(30);
      expect(config.maxBudgetUsd).toBe(0.5);
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
  });

  describe('research worker override', () => {
    it('uses claude-haiku-4-5 model and $0.10 budget for research workers', () => {
      const config = createAgentConfig({
        tier: 'worker',
        role: 'code-explorer',
        department: 'research',
        task: 'Explore the authentication module',
      });
      expect(config.model).toBe('claude-haiku-4-5');
      expect(config.maxBudgetUsd).toBe(0.10);
    });

    it('does not override non-research workers', () => {
      const config = createAgentConfig({
        tier: 'worker',
        role: 'feature-dev',
        department: 'engineering',
        task: 'Implement feature X',
      });
      expect(config.model).toBe('claude-sonnet-4-6');
      expect(config.maxBudgetUsd).toBe(0.5);
    });

    it('does not override research leaders', () => {
      const config = createAgentConfig({
        tier: 'leader',
        role: 'research-leader',
        department: 'research',
      });
      expect(config.model).toBe('claude-sonnet-4-6');
      expect(config.maxBudgetUsd).toBe(2.0);
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
