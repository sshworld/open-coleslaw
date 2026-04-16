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
  createWorker,
  getWorker,
  updateWorker,
  listWorkersByLeader,
} from '../../src/storage/worker-store.js';

const dbMock = await import('../../src/storage/db.js') as any;

beforeEach(() => {
  dbMock.__setTestDb(createTestDb());
});

afterEach(() => {
  dbMock.closeDb();
});

describe('worker-store', () => {
  const baseWorker = {
    leaderId: 'leader-1',
    meetingId: 'meeting-1',
    taskDescription: 'Write unit tests',
    taskType: 'testing' as const,
    inputContext: 'source code context',
    outputResult: null,
    errorMessage: null,
    dependencies: ['dep-1', 'dep-2'],
  };

  describe('createWorker', () => {
    it('should create a worker with defaults', () => {
      const worker = createWorker(baseWorker);

      expect(worker.id).toBeDefined();
      expect(worker.leaderId).toBe('leader-1');
      expect(worker.meetingId).toBe('meeting-1');
      expect(worker.taskDescription).toBe('Write unit tests');
      expect(worker.taskType).toBe('testing');
      expect(worker.status).toBe('pending');
      expect(worker.inputContext).toBe('source code context');
      expect(worker.outputResult).toBeNull();
      expect(worker.errorMessage).toBeNull();
      expect(worker.dependencies).toEqual(['dep-1', 'dep-2']);
      expect(worker.spawnedAt).toBeTypeOf('number');
      expect(worker.completedAt).toBeNull();
      expect(worker.costUsd).toBe(0);
    });

    it('should use provided id and status', () => {
      const worker = createWorker({
        ...baseWorker,
        id: 'wrk-custom',
        status: 'running',
      });
      expect(worker.id).toBe('wrk-custom');
      expect(worker.status).toBe('running');
    });

    it('should persist the worker in the database', () => {
      const worker = createWorker(baseWorker);
      const fetched = getWorker(worker.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(worker.id);
    });

    it('should handle empty dependencies array', () => {
      const worker = createWorker({ ...baseWorker, dependencies: [] });
      expect(worker.dependencies).toEqual([]);

      const fetched = getWorker(worker.id)!;
      expect(fetched.dependencies).toEqual([]);
    });
  });

  describe('getWorker', () => {
    it('should return null for a non-existent worker', () => {
      expect(getWorker('nope')).toBeNull();
    });

    it('should deserialize JSON dependencies field', () => {
      createWorker({ ...baseWorker, id: 'wrk-json' });
      const fetched = getWorker('wrk-json')!;

      expect(Array.isArray(fetched.dependencies)).toBe(true);
      expect(fetched.dependencies).toEqual(['dep-1', 'dep-2']);
    });

    it('should return all fields correctly', () => {
      createWorker({
        ...baseWorker,
        id: 'wrk-all',
        inputContext: 'some context',
        taskType: 'research',
      });

      const fetched = getWorker('wrk-all')!;
      expect(fetched.leaderId).toBe('leader-1');
      expect(fetched.meetingId).toBe('meeting-1');
      expect(fetched.taskDescription).toBe('Write unit tests');
      expect(fetched.taskType).toBe('research');
      expect(fetched.inputContext).toBe('some context');
    });
  });

  describe('updateWorker', () => {
    it('should return null when updating a non-existent worker', () => {
      expect(updateWorker('nope', { status: 'completed' })).toBeNull();
    });

    it('should update status and output', () => {
      createWorker({ ...baseWorker, id: 'wrk-upd' });
      const updated = updateWorker('wrk-upd', {
        status: 'completed',
        outputResult: 'All tests pass',
        completedAt: 5000,
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('completed');
      expect(updated!.outputResult).toBe('All tests pass');
      expect(updated!.completedAt).toBe(5000);
    });

    it('should update dependencies (JSON field)', () => {
      createWorker({ ...baseWorker, id: 'wrk-deps' });
      const updated = updateWorker('wrk-deps', {
        dependencies: ['new-dep'],
      });

      expect(updated!.dependencies).toEqual(['new-dep']);
      const fetched = getWorker('wrk-deps')!;
      expect(fetched.dependencies).toEqual(['new-dep']);
    });

    it('should update error message on failure', () => {
      createWorker({ ...baseWorker, id: 'wrk-fail' });
      const updated = updateWorker('wrk-fail', {
        status: 'failed',
        errorMessage: 'Timeout exceeded',
      });

      expect(updated!.status).toBe('failed');
      expect(updated!.errorMessage).toBe('Timeout exceeded');
    });

    it('should return existing worker when no updates provided', () => {
      createWorker({ ...baseWorker, id: 'wrk-noop' });
      const result = updateWorker('wrk-noop', {});
      expect(result).not.toBeNull();
      expect(result!.id).toBe('wrk-noop');
    });
  });

  describe('listWorkersByLeader', () => {
    it('should return an empty array when no workers for the leader', () => {
      expect(listWorkersByLeader('no-leader')).toEqual([]);
    });

    it('should return only workers belonging to the given leader', () => {
      createWorker({ ...baseWorker, id: 'w1', leaderId: 'leader-A' });
      createWorker({ ...baseWorker, id: 'w2', leaderId: 'leader-A' });
      createWorker({ ...baseWorker, id: 'w3', leaderId: 'leader-B' });

      const leaderA = listWorkersByLeader('leader-A');
      expect(leaderA).toHaveLength(2);
      expect(leaderA.map((w) => w.id).sort()).toEqual(['w1', 'w2']);

      const leaderB = listWorkersByLeader('leader-B');
      expect(leaderB).toHaveLength(1);
      expect(leaderB[0].id).toBe('w3');
    });

    it('should order workers by spawned_at ascending', () => {
      createWorker({ ...baseWorker, id: 'w-old', leaderId: 'leader-X', spawnedAt: 1000 });
      createWorker({ ...baseWorker, id: 'w-new', leaderId: 'leader-X', spawnedAt: 2000 });

      const result = listWorkersByLeader('leader-X');
      expect(result[0].id).toBe('w-old');
      expect(result[1].id).toBe('w-new');
    });
  });
});
