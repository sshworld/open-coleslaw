/**
 * End-to-end integration test for the new architecture.
 *
 * New flow: Orchestrator creates meeting (sync) → transcripts added via MCP tool
 * → minutes generated → action items already structured by planner.
 * No subprocess spawning. Agent dispatch is external (Claude Code Agent tool).
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../fixtures/test-db.js';

vi.mock('../../src/storage/db.js', () => {
  let db: any = null;
  return {
    getDb: () => {
      if (!db) throw new Error('Test DB not initialized');
      return db;
    },
    closeDb: () => {
      if (db) { db.close(); db = null; }
    },
    __setTestDb: (testDb: any) => { db = testDb; },
  };
});

const dbMock = (await import('../../src/storage/db.js')) as any;

const { Orchestrator } = await import('../../src/orchestrator/orchestrator.js');
const { MeetingRunner } = await import('../../src/orchestrator/meeting-runner.js');
const { getMeeting, listMeetings, getMinutesByMeeting } = await import(
  '../../src/storage/index.js'
);

beforeEach(() => {
  dbMock.__setTestDb(createTestDb());
});

afterEach(() => {
  dbMock.closeDb();
});

describe('E2E: meeting data flow', () => {
  it('creates meeting, adds transcripts, generates minutes with action items', async () => {
    const orchestrator = new Orchestrator();

    // 1. Start meeting (sync — just creates record)
    const result = orchestrator.startMeeting({
      topic: 'API Design',
      agenda: ['REST vs GraphQL', 'Auth method'],
    });

    expect(result.meetingId).toBeTruthy();
    expect(result.departments.length).toBeGreaterThanOrEqual(1);
    expect(result.agenda).toHaveLength(2);

    const meeting = getMeeting(result.meetingId);
    expect(meeting).not.toBeNull();
    expect(meeting!.topic).toBe('API Design');
    expect(meeting!.status).toBe('pending');

    // 2. Add transcripts (simulating specialist agent responses via MCP tool)
    const runner = new MeetingRunner(result.meetingId);

    runner.addTranscript('architect', 0, 1,
      'From an architecture perspective, REST is simpler but GraphQL gives more flexibility. I recommend REST for MVP.');
    runner.addTranscript('engineer', 0, 1,
      'Agreed on REST for MVP. We should implement OpenAPI spec for documentation.');
    runner.addTranscript('architect', 1, 1,
      'For auth, JWT with refresh tokens is the standard approach. We need to decide on session storage.');
    runner.addTranscript('engineer', 1, 1,
      'JWT sounds good. Redis for session storage. Must implement rate limiting.');

    // 3. Generate minutes
    const minutesId = await runner.generateMinutes();
    expect(minutesId).toBeTruthy();

    const minutes = getMinutesByMeeting(result.meetingId);
    expect(minutes).not.toBeNull();
    expect(minutes!.content).toContain('Meeting Minutes');
    expect(minutes!.content).toContain('API Design');

    // 4. Minutes include action items (no separate compaction step)
    expect(Array.isArray(minutes!.actionItems)).toBe(true);

    // 5. Meeting shows up in list
    const all = listMeetings();
    expect(all.some((m) => m.id === result.meetingId)).toBe(true);
  });

  it('selectLeaders picks departments based on keywords', () => {
    const orchestrator = new Orchestrator();
    const depts = orchestrator.selectLeaders('Build REST API endpoint', [
      'implement user CRUD',
      'design data schema',
    ]);
    expect(depts).toContain('engineering');
    expect(depts).toContain('architecture');
  });

  it('selectLeaders falls back to engineering for unknown topics', () => {
    const orchestrator = new Orchestrator();
    const depts = orchestrator.selectLeaders('Something very generic', ['Do something']);
    expect(depts).toContain('engineering');
  });
});
