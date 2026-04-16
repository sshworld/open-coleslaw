import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../fixtures/test-db.js';

// Mock the db module BEFORE importing stores
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
  createAgent,
  getAgent,
  updateAgent,
  listAgentsByMeeting,
  listAgentsByParent,
  getAgentTree,
} from '../../src/storage/agent-store.js';

const dbMock = await import('../../src/storage/db.js') as any;

beforeEach(() => {
  dbMock.__setTestDb(createTestDb());
});

afterEach(() => {
  dbMock.closeDb();
});

describe('agent-store', () => {
  const baseAgent = {
    tier: 'orchestrator' as const,
    role: 'lead-orchestrator',
    department: 'architecture' as const,
    parentId: null,
    meetingId: 'meeting-1',
    status: 'idle' as const,
    currentTask: null,
    sessionId: null,
  };

  describe('createAgent', () => {
    it('should create an agent and return it with generated fields', () => {
      const agent = createAgent(baseAgent);

      expect(agent.id).toBeDefined();
      expect(agent.tier).toBe('orchestrator');
      expect(agent.role).toBe('lead-orchestrator');
      expect(agent.department).toBe('architecture');
      expect(agent.parentId).toBeNull();
      expect(agent.meetingId).toBe('meeting-1');
      expect(agent.status).toBe('idle');
      expect(agent.spawnedAt).toBeTypeOf('number');
      expect(agent.completedAt).toBeNull();
      expect(agent.costUsd).toBe(0);
    });

    it('should use provided id when given', () => {
      const agent = createAgent({ ...baseAgent, id: 'custom-id' });
      expect(agent.id).toBe('custom-id');
    });

    it('should persist the agent in the database', () => {
      const agent = createAgent(baseAgent);
      const fetched = getAgent(agent.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(agent.id);
      expect(fetched!.tier).toBe(agent.tier);
    });

    it('should use provided spawnedAt and costUsd', () => {
      const agent = createAgent({
        ...baseAgent,
        spawnedAt: 1000,
        costUsd: 0.5,
      });
      expect(agent.spawnedAt).toBe(1000);
      expect(agent.costUsd).toBe(0.5);
    });
  });

  describe('getAgent', () => {
    it('should return null for a non-existent agent', () => {
      const result = getAgent('does-not-exist');
      expect(result).toBeNull();
    });

    it('should return the correct agent with all fields', () => {
      const created = createAgent({
        ...baseAgent,
        id: 'agent-1',
        currentTask: 'do something',
        sessionId: 'session-abc',
      });

      const fetched = getAgent('agent-1')!;
      expect(fetched.id).toBe('agent-1');
      expect(fetched.tier).toBe('orchestrator');
      expect(fetched.role).toBe('lead-orchestrator');
      expect(fetched.department).toBe('architecture');
      expect(fetched.parentId).toBeNull();
      expect(fetched.meetingId).toBe('meeting-1');
      expect(fetched.status).toBe('idle');
      expect(fetched.currentTask).toBe('do something');
      expect(fetched.sessionId).toBe('session-abc');
      expect(fetched.spawnedAt).toBe(created.spawnedAt);
      expect(fetched.completedAt).toBeNull();
      expect(fetched.costUsd).toBe(0);
    });
  });

  describe('updateAgent', () => {
    it('should return null when updating a non-existent agent', () => {
      const result = updateAgent('nope', { status: 'completed' });
      expect(result).toBeNull();
    });

    it('should update the status and persist the change', () => {
      const agent = createAgent({ ...baseAgent, id: 'agent-upd' });
      const updated = updateAgent('agent-upd', { status: 'working' });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('working');

      const fetched = getAgent('agent-upd')!;
      expect(fetched.status).toBe('working');
    });

    it('should update multiple fields at once', () => {
      createAgent({ ...baseAgent, id: 'agent-multi' });
      const updated = updateAgent('agent-multi', {
        status: 'completed',
        completedAt: 9999,
        costUsd: 1.23,
        currentTask: 'finished',
      });

      expect(updated!.status).toBe('completed');
      expect(updated!.completedAt).toBe(9999);
      expect(updated!.costUsd).toBe(1.23);
      expect(updated!.currentTask).toBe('finished');
    });

    it('should return the existing agent when no updates provided', () => {
      const agent = createAgent({ ...baseAgent, id: 'agent-noop' });
      const result = updateAgent('agent-noop', {});
      expect(result).not.toBeNull();
      expect(result!.id).toBe('agent-noop');
      expect(result!.status).toBe(agent.status);
    });
  });

  describe('listAgentsByMeeting', () => {
    it('should return an empty array for a meeting with no agents', () => {
      const result = listAgentsByMeeting('empty-meeting');
      expect(result).toEqual([]);
    });

    it('should return only agents belonging to the given meeting', () => {
      createAgent({ ...baseAgent, id: 'a1', meetingId: 'meeting-A' });
      createAgent({ ...baseAgent, id: 'a2', meetingId: 'meeting-A' });
      createAgent({ ...baseAgent, id: 'a3', meetingId: 'meeting-B' });

      const meetingA = listAgentsByMeeting('meeting-A');
      expect(meetingA).toHaveLength(2);
      expect(meetingA.map((a) => a.id).sort()).toEqual(['a1', 'a2']);

      const meetingB = listAgentsByMeeting('meeting-B');
      expect(meetingB).toHaveLength(1);
      expect(meetingB[0].id).toBe('a3');
    });
  });

  describe('listAgentsByParent', () => {
    it('should return an empty array when parent has no children', () => {
      createAgent({ ...baseAgent, id: 'solo' });
      const result = listAgentsByParent('solo');
      expect(result).toEqual([]);
    });

    it('should return child agents for a given parent', () => {
      createAgent({ ...baseAgent, id: 'parent' });
      createAgent({ ...baseAgent, id: 'child-1', tier: 'leader', parentId: 'parent' });
      createAgent({ ...baseAgent, id: 'child-2', tier: 'leader', parentId: 'parent' });
      createAgent({ ...baseAgent, id: 'other-child', tier: 'leader', parentId: 'other-parent' });

      const children = listAgentsByParent('parent');
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.id).sort()).toEqual(['child-1', 'child-2']);
    });
  });

  describe('getAgentTree', () => {
    it('should return null for a non-existent root', () => {
      const tree = getAgentTree('nope');
      expect(tree).toBeNull();
    });

    it('should return a tree node with empty children for a leaf', () => {
      createAgent({ ...baseAgent, id: 'leaf' });
      const tree = getAgentTree('leaf')!;
      expect(tree.id).toBe('leaf');
      expect(tree.children).toEqual([]);
    });

    it('should build a 3-tier hierarchy correctly', () => {
      createAgent({ ...baseAgent, id: 'root', tier: 'orchestrator' });
      createAgent({ ...baseAgent, id: 'leader-1', tier: 'leader', parentId: 'root' });
      createAgent({ ...baseAgent, id: 'leader-2', tier: 'leader', parentId: 'root' });
      createAgent({ ...baseAgent, id: 'worker-1', tier: 'worker', parentId: 'leader-1' });
      createAgent({ ...baseAgent, id: 'worker-2', tier: 'worker', parentId: 'leader-1' });
      createAgent({ ...baseAgent, id: 'worker-3', tier: 'worker', parentId: 'leader-2' });

      const tree = getAgentTree('root')!;

      expect(tree.id).toBe('root');
      expect(tree.children).toHaveLength(2);

      const leader1 = tree.children.find((c) => c.id === 'leader-1')!;
      const leader2 = tree.children.find((c) => c.id === 'leader-2')!;

      expect(leader1.children).toHaveLength(2);
      expect(leader1.children.map((w) => w.id).sort()).toEqual(['worker-1', 'worker-2']);

      expect(leader2.children).toHaveLength(1);
      expect(leader2.children[0].id).toBe('worker-3');

      // Workers are leaves
      expect(leader1.children[0].children).toEqual([]);
    });
  });
});
