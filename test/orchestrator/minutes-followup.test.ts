/**
 * MeetingRunner.generateMinutes must be idempotent and append-aware so
 * follow-up discussion added after the first minutes are written doesn't
 * disappear from the markdown.
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
const { MeetingRunner } = await import('../../src/orchestrator/meeting-runner.js');
const { createMeeting, getMinutesByMeeting } = await import('../../src/storage/index.js');

beforeEach(() => {
  dbMock.__setTestDb(createTestDb());
});

afterEach(() => {
  dbMock.closeDb();
});

async function seedMeeting(): Promise<string> {
  const m = createMeeting({
    topic: 'Test',
    agenda: ['Agenda one'],
    participantIds: ['planner', 'engineer'],
    initiatedBy: 'user',
    status: 'in-progress',
    phase: 'discussion' as const,
    startedAt: Date.now(),
  });
  return m.id;
}

describe('MeetingRunner.generateMinutes — follow-up discussion', () => {
  it('returns the existing minutes unchanged when no new transcripts arrive', async () => {
    const meetingId = await seedMeeting();
    const runner = new MeetingRunner(meetingId);
    runner.addTranscript('planner', -1, 0, 'opening');
    const id1 = await runner.generateMinutes();

    const id2 = await runner.generateMinutes();
    expect(id2).toBe(id1);

    const minutes = getMinutesByMeeting(meetingId);
    expect(minutes?.content).not.toMatch(/Follow-up Discussion/);
  });

  it('appends a Follow-up Discussion section when new transcripts arrive after first generation', async () => {
    const meetingId = await seedMeeting();
    const runner = new MeetingRunner(meetingId);
    runner.addTranscript('planner', -1, 0, 'opening');
    runner.addTranscript('engineer', 0, 1, 'initial take');
    const id1 = await runner.generateMinutes();

    const originalMinutes = getMinutesByMeeting(meetingId);
    expect(originalMinutes?.content).not.toMatch(/Follow-up Discussion/);

    // Simulate follow-up turns (user comment + specialist response).
    // Space createdAt timestamps forward by one millisecond so they sort
    // strictly after the original minutes.createdAt.
    await new Promise((r) => setTimeout(r, 5));
    runner.addTranscript('user', -3, 2, 'actually, reconsider option X');
    runner.addTranscript('engineer', 0, 2, 'good point, revising');

    const id2 = await runner.generateMinutes();
    expect(id2).toBe(id1); // same minutes row

    const updated = getMinutesByMeeting(meetingId);
    expect(updated?.content).toMatch(/Follow-up Discussion/);
    expect(updated?.content).toMatch(/actually, reconsider option X/);
    expect(updated?.content).toMatch(/good point, revising/);

    // Original content must still be there (we appended, didn't replace)
    expect(updated?.content).toMatch(/initial take/);
    expect(updated?.content).toMatch(/^# Meeting Minutes/m);
  });

  it('user comments in the follow-up are flagged as such in the appended section', async () => {
    const meetingId = await seedMeeting();
    const runner = new MeetingRunner(meetingId);
    runner.addTranscript('planner', -1, 0, 'opening');
    await runner.generateMinutes();

    await new Promise((r) => setTimeout(r, 5));
    runner.addTranscript('user', -3, 1, '다른 방향으로 가자');
    await runner.generateMinutes();

    const updated = getMinutesByMeeting(meetingId);
    expect(updated?.content).toMatch(/user comment/);
    expect(updated?.content).toMatch(/다른 방향으로 가자/);
  });
});
