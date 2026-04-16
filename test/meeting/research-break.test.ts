import { describe, it, expect } from 'vitest';
import {
  detectResearchBreak,
  formatResearchResult,
} from '../../src/meeting/research-break.js';
import type { ResearchBreakRequest } from '../../src/meeting/research-break.js';

describe('detectResearchBreak', () => {
  it('detects [RESEARCH_BREAK: ...] marker and returns request', () => {
    const response = 'Before we decide, [RESEARCH_BREAK: What is the API rate limit?]';
    const result = detectResearchBreak(response);

    expect(result).not.toBeNull();
    expect(result!.question).toBe('What is the API rate limit?');
    expect(result!.requestingLeader).toBe('');
    expect(result!.estimatedDuration).toBe('quick');
  });

  it('returns null when no marker is present', () => {
    const response = 'No break here. Let us continue the discussion.';
    const result = detectResearchBreak(response);
    expect(result).toBeNull();
  });

  it('estimates "quick" for short simple questions', () => {
    const result = detectResearchBreak('[RESEARCH_BREAK: What version of Node is required?]');
    expect(result).not.toBeNull();
    expect(result!.estimatedDuration).toBe('quick');
  });

  it('estimates "medium" for questions with "compare"', () => {
    const result = detectResearchBreak(
      '[RESEARCH_BREAK: Compare PostgreSQL vs MySQL performance for our use case]',
    );
    expect(result).not.toBeNull();
    expect(result!.estimatedDuration).toBe('medium');
  });

  it('estimates "medium" for questions with "benchmark"', () => {
    const result = detectResearchBreak(
      '[RESEARCH_BREAK: Benchmark the serialization approaches]',
    );
    expect(result).not.toBeNull();
    expect(result!.estimatedDuration).toBe('medium');
  });

  it('estimates "medium" for questions with "analyze"', () => {
    const result = detectResearchBreak(
      '[RESEARCH_BREAK: Analyze the dependency graph for circular imports]',
    );
    expect(result).not.toBeNull();
    expect(result!.estimatedDuration).toBe('medium');
  });

  it('estimates "medium" for long questions (>= 80 chars)', () => {
    const longQuestion = 'What are all the different authentication strategies used across the codebase and which ones still work';
    const result = detectResearchBreak(`[RESEARCH_BREAK: ${longQuestion}]`);
    expect(result).not.toBeNull();
    expect(result!.estimatedDuration).toBe('medium');
  });

  it('trims whitespace from the question', () => {
    const result = detectResearchBreak('[RESEARCH_BREAK:   spaces around question   ]');
    expect(result).not.toBeNull();
    expect(result!.question).toBe('spaces around question');
  });
});

describe('formatResearchResult', () => {
  it('returns formatted markdown with request details and result', () => {
    const request: ResearchBreakRequest = {
      requestingLeader: 'architect',
      question: 'What is the API rate limit?',
      estimatedDuration: 'quick',
    };

    const formatted = formatResearchResult(request, 'The rate limit is 100 requests per minute.');

    expect(formatted).toContain('---');
    expect(formatted).toContain('Research Break Result');
    expect(formatted).toContain('architect');
    expect(formatted).toContain('What is the API rate limit?');
    expect(formatted).toContain('The rate limit is 100 requests per minute.');
  });

  it('includes the requesting leader name', () => {
    const request: ResearchBreakRequest = {
      requestingLeader: 'engineer',
      question: 'How does the cache work?',
      estimatedDuration: 'quick',
    };

    const formatted = formatResearchResult(request, 'It uses LRU with a 5min TTL.');
    expect(formatted).toContain('engineer');
  });
});
