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

import {
  createMeeting,
  getMeeting,
  updateMeeting,
  listMeetings,
} from '../../src/storage/meeting-store.js';

const dbMock = await import('../../src/storage/db.js') as any;

beforeEach(() => {
  dbMock.__setTestDb(createTestDb());
});

afterEach(() => {
  dbMock.closeDb();
});

describe('meeting-store', () => {
  const baseMeeting = {
    topic: 'Design the API',
    agenda: ['endpoint design', 'auth strategy', 'rate limiting'],
    participantIds: ['agent-1', 'agent-2'],
    initiatedBy: 'user',
  };

  describe('createMeeting', () => {
    it('should create a meeting with defaults', () => {
      const meeting = createMeeting(baseMeeting);

      expect(meeting.id).toBeDefined();
      expect(meeting.topic).toBe('Design the API');
      expect(meeting.agenda).toEqual(['endpoint design', 'auth strategy', 'rate limiting']);
      expect(meeting.participantIds).toEqual(['agent-1', 'agent-2']);
      expect(meeting.status).toBe('pending');
      expect(meeting.phase).toBe('orchestrator-phase');
      expect(meeting.startedAt).toBeNull();
      expect(meeting.completedAt).toBeNull();
      expect(meeting.initiatedBy).toBe('user');
      expect(meeting.previousMeetingId).toBeNull();
    });

    it('should use provided id and status', () => {
      const meeting = createMeeting({
        ...baseMeeting,
        id: 'mtg-custom',
        status: 'convening',
        phase: 'convening',
      });
      expect(meeting.id).toBe('mtg-custom');
      expect(meeting.status).toBe('convening');
      expect(meeting.phase).toBe('convening');
    });

    it('should serialize agenda as JSON in the database', () => {
      const meeting = createMeeting(baseMeeting);
      const fetched = getMeeting(meeting.id)!;
      expect(fetched.agenda).toEqual(['endpoint design', 'auth strategy', 'rate limiting']);
      expect(Array.isArray(fetched.agenda)).toBe(true);
    });

    it('should store previousMeetingId when provided', () => {
      const meeting = createMeeting({
        ...baseMeeting,
        previousMeetingId: 'prev-mtg',
      });
      expect(meeting.previousMeetingId).toBe('prev-mtg');
      const fetched = getMeeting(meeting.id)!;
      expect(fetched.previousMeetingId).toBe('prev-mtg');
    });
  });

  describe('getMeeting', () => {
    it('should return null for a non-existent meeting', () => {
      const result = getMeeting('does-not-exist');
      expect(result).toBeNull();
    });

    it('should retrieve a meeting and deserialize JSON fields', () => {
      createMeeting({ ...baseMeeting, id: 'mtg-get' });
      const meeting = getMeeting('mtg-get')!;

      expect(meeting.id).toBe('mtg-get');
      expect(meeting.topic).toBe('Design the API');
      expect(Array.isArray(meeting.agenda)).toBe(true);
      expect(meeting.agenda).toHaveLength(3);
      expect(Array.isArray(meeting.participantIds)).toBe(true);
      expect(meeting.participantIds).toHaveLength(2);
    });
  });

  describe('updateMeeting', () => {
    it('should return null when updating a non-existent meeting', () => {
      const result = updateMeeting('nope', { status: 'completed' });
      expect(result).toBeNull();
    });

    it('should update status and phase', () => {
      createMeeting({ ...baseMeeting, id: 'mtg-upd' });
      const updated = updateMeeting('mtg-upd', {
        status: 'discussion',
        phase: 'discussion',
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('discussion');
      expect(updated!.phase).toBe('discussion');

      const fetched = getMeeting('mtg-upd')!;
      expect(fetched.status).toBe('discussion');
      expect(fetched.phase).toBe('discussion');
    });

    it('should update agenda (JSON field)', () => {
      createMeeting({ ...baseMeeting, id: 'mtg-agenda' });
      const updated = updateMeeting('mtg-agenda', {
        agenda: ['new item 1', 'new item 2'],
      });

      expect(updated!.agenda).toEqual(['new item 1', 'new item 2']);
      const fetched = getMeeting('mtg-agenda')!;
      expect(fetched.agenda).toEqual(['new item 1', 'new item 2']);
    });

    it('should return existing meeting when no updates provided', () => {
      createMeeting({ ...baseMeeting, id: 'mtg-noop' });
      const result = updateMeeting('mtg-noop', {});
      expect(result).not.toBeNull();
      expect(result!.id).toBe('mtg-noop');
    });
  });

  describe('listMeetings', () => {
    it('should return an empty array when no meetings exist', () => {
      const result = listMeetings();
      expect(result).toEqual([]);
    });

    it('should return all meetings when no filter is given', () => {
      createMeeting({ ...baseMeeting, id: 'mtg-1' });
      createMeeting({ ...baseMeeting, id: 'mtg-2' });
      const result = listMeetings();
      expect(result).toHaveLength(2);
    });

    it('should filter by status', () => {
      createMeeting({ ...baseMeeting, id: 'mtg-pend', status: 'pending' });
      createMeeting({ ...baseMeeting, id: 'mtg-comp', status: 'completed' });
      createMeeting({ ...baseMeeting, id: 'mtg-pend2', status: 'pending' });

      const pending = listMeetings('pending');
      expect(pending).toHaveLength(2);
      expect(pending.every((m) => m.status === 'pending')).toBe(true);

      const completed = listMeetings('completed');
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe('mtg-comp');
    });

    it('should order by started_at descending', () => {
      createMeeting({ ...baseMeeting, id: 'mtg-old', startedAt: 1000 });
      createMeeting({ ...baseMeeting, id: 'mtg-new', startedAt: 2000 });

      const result = listMeetings();
      expect(result[0].id).toBe('mtg-new');
      expect(result[1].id).toBe('mtg-old');
    });
  });
});
