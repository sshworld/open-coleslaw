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
  createMention,
  getMention,
  updateMention,
  listPendingMentions,
  listMentionsByMeeting,
} from '../../src/storage/mention-store.js';

const dbMock = await import('../../src/storage/db.js') as any;

beforeEach(() => {
  dbMock.__setTestDb(createTestDb());
});

afterEach(() => {
  dbMock.closeDb();
});

describe('mention-store', () => {
  const sampleOptions = [
    {
      label: 'Option A',
      description: 'Use REST API',
      supportedBy: ['agent-1'],
    },
    {
      label: 'Option B',
      description: 'Use GraphQL',
      supportedBy: ['agent-2', 'agent-3'],
    },
  ];

  const baseMention = {
    meetingId: 'meeting-1',
    agendaItem: 'API design',
    summary: 'Need to decide between REST and GraphQL',
    options: sampleOptions,
    urgency: 'blocking' as const,
    userDecision: null,
    userReasoning: null,
  };

  describe('createMention', () => {
    it('should create a mention with defaults', () => {
      const mention = createMention(baseMention);

      expect(mention.id).toBeDefined();
      expect(mention.meetingId).toBe('meeting-1');
      expect(mention.agendaItem).toBe('API design');
      expect(mention.summary).toBe('Need to decide between REST and GraphQL');
      expect(mention.options).toEqual(sampleOptions);
      expect(mention.urgency).toBe('blocking');
      expect(mention.status).toBe('pending');
      expect(mention.userDecision).toBeNull();
      expect(mention.userReasoning).toBeNull();
      expect(mention.createdAt).toBeTypeOf('number');
      expect(mention.resolvedAt).toBeNull();
    });

    it('should use provided id', () => {
      const mention = createMention({ ...baseMention, id: 'mention-custom' });
      expect(mention.id).toBe('mention-custom');
    });

    it('should serialize options as JSON in the database', () => {
      const mention = createMention(baseMention);
      const fetched = getMention(mention.id)!;
      expect(Array.isArray(fetched.options)).toBe(true);
      expect(fetched.options).toEqual(sampleOptions);
    });

    it('should handle null agendaItem', () => {
      const mention = createMention({ ...baseMention, agendaItem: null });
      expect(mention.agendaItem).toBeNull();
      const fetched = getMention(mention.id)!;
      expect(fetched.agendaItem).toBeNull();
    });
  });

  describe('getMention', () => {
    it('should return null for a non-existent mention', () => {
      expect(getMention('nope')).toBeNull();
    });

    it('should deserialize options JSON correctly', () => {
      createMention({ ...baseMention, id: 'mention-json' });
      const fetched = getMention('mention-json')!;

      expect(fetched.options).toHaveLength(2);
      expect(fetched.options[0].label).toBe('Option A');
      expect(fetched.options[0].supportedBy).toEqual(['agent-1']);
      expect(fetched.options[1].label).toBe('Option B');
      expect(fetched.options[1].supportedBy).toEqual(['agent-2', 'agent-3']);
    });
  });

  describe('updateMention', () => {
    it('should return null when updating a non-existent mention', () => {
      expect(updateMention('nope', { status: 'resolved' })).toBeNull();
    });

    it('should resolve a mention with user decision', () => {
      createMention({ ...baseMention, id: 'mention-resolve' });
      const resolvedAt = Date.now();
      const updated = updateMention('mention-resolve', {
        status: 'resolved',
        userDecision: 'Option A',
        userReasoning: 'REST is simpler for our use case',
        resolvedAt,
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('resolved');
      expect(updated!.userDecision).toBe('Option A');
      expect(updated!.userReasoning).toBe('REST is simpler for our use case');
      expect(updated!.resolvedAt).toBe(resolvedAt);
    });

    it('should update options (JSON field)', () => {
      createMention({ ...baseMention, id: 'mention-opts' });
      const newOptions = [{ label: 'Option C', description: 'gRPC', supportedBy: ['agent-4'] }];
      const updated = updateMention('mention-opts', { options: newOptions });

      expect(updated!.options).toEqual(newOptions);
      const fetched = getMention('mention-opts')!;
      expect(fetched.options).toEqual(newOptions);
    });

    it('should return existing mention when no updates provided', () => {
      createMention({ ...baseMention, id: 'mention-noop' });
      const result = updateMention('mention-noop', {});
      expect(result).not.toBeNull();
      expect(result!.id).toBe('mention-noop');
    });
  });

  describe('listPendingMentions', () => {
    it('should return an empty array when no mentions exist', () => {
      expect(listPendingMentions()).toEqual([]);
    });

    it('should return only pending mentions', () => {
      createMention({ ...baseMention, id: 'm-pending-1' });
      createMention({ ...baseMention, id: 'm-pending-2' });
      createMention({ ...baseMention, id: 'm-resolved', status: 'resolved' });
      createMention({ ...baseMention, id: 'm-expired', status: 'expired' });

      const pending = listPendingMentions();
      expect(pending).toHaveLength(2);
      expect(pending.every((m) => m.status === 'pending')).toBe(true);
      expect(pending.map((m) => m.id).sort()).toEqual(['m-pending-1', 'm-pending-2']);
    });

    it('should order by created_at ascending', () => {
      createMention({ ...baseMention, id: 'm-new', createdAt: 2000 });
      createMention({ ...baseMention, id: 'm-old', createdAt: 1000 });

      const pending = listPendingMentions();
      expect(pending[0].id).toBe('m-old');
      expect(pending[1].id).toBe('m-new');
    });
  });

  describe('listMentionsByMeeting', () => {
    it('should return an empty array for a meeting with no mentions', () => {
      expect(listMentionsByMeeting('empty-meeting')).toEqual([]);
    });

    it('should return only mentions for the specified meeting', () => {
      createMention({ ...baseMention, id: 'mm-1', meetingId: 'mtg-A' });
      createMention({ ...baseMention, id: 'mm-2', meetingId: 'mtg-A' });
      createMention({ ...baseMention, id: 'mm-3', meetingId: 'mtg-B' });

      const mtgA = listMentionsByMeeting('mtg-A');
      expect(mtgA).toHaveLength(2);
      expect(mtgA.map((m) => m.id).sort()).toEqual(['mm-1', 'mm-2']);

      const mtgB = listMentionsByMeeting('mtg-B');
      expect(mtgB).toHaveLength(1);
      expect(mtgB[0].id).toBe('mm-3');
    });

    it('should include both pending and resolved mentions for a meeting', () => {
      createMention({ ...baseMention, id: 'mm-pend', meetingId: 'mtg-mix' });
      createMention({ ...baseMention, id: 'mm-res', meetingId: 'mtg-mix', status: 'resolved' });

      const result = listMentionsByMeeting('mtg-mix');
      expect(result).toHaveLength(2);
    });
  });
});
