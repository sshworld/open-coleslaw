/**
 * Integration tests for MCP tool handlers.
 *
 * These call the handler functions directly with an in-memory SQLite DB,
 * verifying the response shape and basic behaviour.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../fixtures/test-db.js';

// ---------------------------------------------------------------------------
// DB mock — must be declared before any import that reaches storage
// ---------------------------------------------------------------------------

vi.mock('../../src/storage/db.js', () => {
  let db: any = null;
  return {
    getDb: () => {
      if (!db) throw new Error('Test DB not initialized');
      return db;
    },
    closeDb: () => {
      if (db) {
        db.close();
        db = null;
      }
    },
    __setTestDb: (testDb: any) => {
      db = testDb;
    },
  };
});

const dbMock = (await import('../../src/storage/db.js')) as any;

// ---------------------------------------------------------------------------
// Imports under test
// ---------------------------------------------------------------------------

const { getMeetingStatusHandler } = await import('../../src/tools/get-meeting-status.js');
const { listMeetingsHandler } = await import('../../src/tools/list-meetings.js');
const { getAgentTreeHandler } = await import('../../src/tools/get-agent-tree.js');
const { getMentionsHandler } = await import('../../src/tools/get-mentions.js');
const { getCostSummaryHandler } = await import('../../src/tools/get-cost-summary.js');

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  process.env.COLESLAW_MOCK = '1';
  dbMock.__setTestDb(createTestDb());
});

afterEach(() => {
  dbMock.closeDb();
  delete process.env.COLESLAW_MOCK;
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function parseContent(result: { content: { type: string; text: string }[] }) {
  expect(result).toHaveProperty('content');
  expect(result.content.length).toBeGreaterThanOrEqual(1);
  expect(result.content[0]).toHaveProperty('type', 'text');
  return JSON.parse(result.content[0].text);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getMeetingStatusHandler', () => {
  it('returns valid response with empty meetings', async () => {
    const result = await getMeetingStatusHandler({});
    const data = parseContent(result);

    expect(data).toHaveProperty('totalMeetings', 0);
    expect(data).toHaveProperty('activeMeetings');
    expect(Array.isArray(data.activeMeetings)).toBe(true);
    expect(data.activeMeetings).toHaveLength(0);
  });

  it('returns isError when meetingId is not found', async () => {
    const result = await getMeetingStatusHandler({ meetingId: 'non-existent-id' });
    expect(result.isError).toBe(true);
    const data = parseContent(result);
    expect(data).toHaveProperty('error');
  });
});

describe('listMeetingsHandler', () => {
  it('returns valid response with no meetings', async () => {
    const result = await listMeetingsHandler({});
    const data = parseContent(result);

    expect(data).toHaveProperty('total', 0);
    expect(data).toHaveProperty('returned', 0);
    expect(data).toHaveProperty('meetings');
    expect(Array.isArray(data.meetings)).toBe(true);
  });

  it('respects status filter', async () => {
    const result = await listMeetingsHandler({ status: 'completed' });
    const data = parseContent(result);
    expect(data).toHaveProperty('status', 'completed');
    expect(data.total).toBe(0);
  });

  it('respects limit parameter', async () => {
    const result = await listMeetingsHandler({ limit: 5 });
    const data = parseContent(result);
    expect(data).toHaveProperty('returned');
    expect(data.returned).toBeLessThanOrEqual(5);
  });
});

describe('getAgentTreeHandler', () => {
  it('returns valid response structure', async () => {
    const result = await getAgentTreeHandler();
    const data = parseContent(result);

    expect(data).toHaveProperty('root');
    expect(data).toHaveProperty('hasAgents');
    // No orchestrator agent in DB yet, so root is null.
    expect(data.root).toBeNull();
    expect(data.hasAgents).toBe(false);
  });
});

describe('getMentionsHandler', () => {
  it('returns empty pending mentions initially', async () => {
    const result = await getMentionsHandler({ status: 'pending' });
    const data = parseContent(result);

    expect(data).toHaveProperty('count', 0);
    expect(data).toHaveProperty('status', 'pending');
    expect(data).toHaveProperty('mentions');
    expect(Array.isArray(data.mentions)).toBe(true);
    expect(data.mentions).toHaveLength(0);
  });

  it('returns empty resolved mentions', async () => {
    const result = await getMentionsHandler({ status: 'resolved' });
    const data = parseContent(result);

    expect(data).toHaveProperty('count', 0);
    expect(data.mentions).toHaveLength(0);
  });

  it('returns all mentions (also empty)', async () => {
    const result = await getMentionsHandler({ status: 'all' });
    const data = parseContent(result);

    expect(data).toHaveProperty('count', 0);
    expect(data).toHaveProperty('status', 'all');
  });
});

describe('getCostSummaryHandler', () => {
  it('returns valid cost summary structure', async () => {
    const result = await getCostSummaryHandler({});
    const data = parseContent(result);

    expect(data).toHaveProperty('totalUsd');
    expect(typeof data.totalUsd).toBe('number');
    expect(data).toHaveProperty('byMeeting');
    expect(data).toHaveProperty('byDepartment');
    expect(data).toHaveProperty('byTier');
  });
});
