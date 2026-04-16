/**
 * End-to-end integration test for the full meeting flow.
 *
 * Exercises: Orchestrator -> LeaderPool -> MeetingRunner -> minutes generation
 *           -> Compactor, all backed by an in-memory SQLite DB and mock agent
 *           responses (COLESLAW_MOCK=1).
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../fixtures/test-db.js';

// ---------------------------------------------------------------------------
// DB mock — must come before any storage import
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

const { Orchestrator } = await import('../../src/orchestrator/orchestrator.js');
const { Compactor } = await import('../../src/meeting/compactor.js');
const { getMeeting, listMeetings, listAgentsByMeeting, getMinutesByMeeting } = await import(
  '../../src/storage/index.js'
);

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
// Full flow test
// ---------------------------------------------------------------------------

describe('E2E: full meeting flow', () => {
  it(
    'runs a complete meeting through orchestrator and generates minutes',
    async () => {
      const orchestrator = new Orchestrator();

      // Start a meeting — this runs the full pipeline: convening -> opening
      // -> discussion -> synthesis -> minutes-generation -> completed.
      const meetingId = await orchestrator.startMeeting({
        topic: 'API Design',
        agenda: ['REST vs GraphQL', 'Auth method'],
      });

      // 1. Meeting was created and completed.
      expect(meetingId).toBeTruthy();

      const meeting = getMeeting(meetingId);
      expect(meeting).not.toBeNull();
      expect(meeting!.topic).toBe('API Design');
      expect(meeting!.status).toBe('completed');
      expect(meeting!.completedAt).toBeGreaterThan(0);

      // 2. Leaders (agents) were spawned.
      const agents = listAgentsByMeeting(meetingId);
      expect(agents.length).toBeGreaterThanOrEqual(1);

      // All leaders should be completed (deactivated after meeting).
      for (const agent of agents) {
        expect(agent.tier).toBe('leader');
        expect(agent.status).toBe('completed');
      }

      // 3. Transcript entries exist.
      const db = dbMock.getDb();
      const transcriptRows = db
        .prepare('SELECT * FROM transcript_entries WHERE meeting_id = ?')
        .all(meetingId);
      expect(transcriptRows.length).toBeGreaterThan(0);

      // 4. Minutes were generated.
      const minutes = getMinutesByMeeting(meetingId);
      expect(minutes).not.toBeNull();
      expect(minutes!.content).toContain('Meeting Minutes');
      expect(minutes!.content).toContain('API Design');
      expect(minutes!.actionItems.length).toBeGreaterThanOrEqual(1);

      // 5. Compact the minutes.
      const compactor = new Compactor();
      const actionItems = await compactor.compactMinutes(meetingId);

      expect(actionItems.length).toBeGreaterThanOrEqual(1);
      for (const item of actionItems) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('assignedDepartment');
        expect(item).toHaveProperty('priority');
      }

      // 6. Cost summary (via Orchestrator.getStatus).
      const status = orchestrator.getStatus();
      // The meeting we just ran should not be active anymore.
      expect(
        status.activeMeetings.some((m) => m.id === meetingId),
      ).toBe(false);

      // 7. Meeting shows up in listMeetings.
      const all = listMeetings();
      expect(all.some((m) => m.id === meetingId)).toBe(true);
    },
    30_000, // allow up to 30 seconds for mock meeting flow
  );

  it('selectLeaders picks departments based on keywords', () => {
    const orchestrator = new Orchestrator();

    // Topic with engineering + architecture keywords
    const depts = orchestrator.selectLeaders('Build REST API endpoint', [
      'implement user CRUD',
      'design data schema',
    ]);

    expect(depts).toContain('engineering');
    // "schema" and "design" should trigger architecture
    expect(depts).toContain('architecture');
  });

  it('selectLeaders falls back to engineering for unknown topics', () => {
    const orchestrator = new Orchestrator();

    const depts = orchestrator.selectLeaders('Something very generic', [
      'Do something',
    ]);

    // Fallback for simple topics (< 3 agenda items) is engineering only.
    expect(depts).toContain('engineering');
  });
});
