/**
 * Tests for `update-mvps` MCP tool: upsert the per-kickoff MVP list, patch
 * single MVP statuses, and emit `mvp_progress` so the dashboard sidebar
 * stays in sync.
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
const { updateMvpsHandler } = await import('../../src/tools/update-mvps.js');
const { eventBus } = await import('../../src/orchestrator/event-bus.js');

beforeEach(() => {
  const testDb = createTestDb();
  dbMock.__setTestDb(testDb);
});

afterEach(() => {
  dbMock.closeDb();
  eventBus.removeAllListeners('agent_event');
});

describe('update-mvps handler', () => {
  it('rejects when neither mvps nor patch is provided', async () => {
    const result = await updateMvpsHandler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/mvps.*patch|patch.*mvps/);
  });

  it('rejects `mvps` without kickoffMeetingId', async () => {
    const result = await updateMvpsHandler({
      mvps: [{ id: 'mvp-1', title: 't', goal: 'g', status: 'pending', orderIndex: 0 }],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/kickoffMeetingId/);
  });

  it('rejects a patch for a non-existent MVP', async () => {
    const result = await updateMvpsHandler({
      patch: { id: 'nope', status: 'done' },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not found/i);
  });

  it('upserts the full MVP list and emits mvp_progress', async () => {
    const events: unknown[] = [];
    eventBus.on('agent_event', (e) => events.push(e));

    const result = await updateMvpsHandler({
      kickoffMeetingId: 'kickoff-1',
      mvps: [
        { id: 'mvp-1', title: 'Core', goal: 'the core', status: 'in-progress', orderIndex: 0 },
        { id: 'mvp-2', title: 'Share', goal: 'sharing',  status: 'pending',     orderIndex: 1 },
      ],
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text) as { mvps: Array<{ id: string; status: string }> };
    expect(parsed.mvps).toHaveLength(2);
    expect(parsed.mvps[0]).toMatchObject({ id: 'mvp-1', status: 'in-progress' });
    expect(parsed.mvps[1]).toMatchObject({ id: 'mvp-2', status: 'pending' });

    const emitted = events.find((e: any) => e.kind === 'mvp_progress') as any;
    expect(emitted).toBeDefined();
    expect(emitted.mvps).toHaveLength(2);
    expect(emitted.mvps[0].id).toBe('mvp-1');
  });

  it('patches a single MVP status and emits mvp_progress with the refreshed list', async () => {
    // Seed two MVPs first
    await updateMvpsHandler({
      kickoffMeetingId: 'kickoff-1',
      mvps: [
        { id: 'mvp-1', title: 'Core', goal: 'g', status: 'in-progress', orderIndex: 0 },
        { id: 'mvp-2', title: 'Share', goal: 'g', status: 'pending',    orderIndex: 1 },
      ],
    });

    const events: unknown[] = [];
    eventBus.on('agent_event', (e) => events.push(e));

    const result = await updateMvpsHandler({ patch: { id: 'mvp-1', status: 'done' } });
    expect(result.isError).toBeUndefined();

    const parsed = JSON.parse(result.content[0].text) as { mvps: Array<{ id: string; status: string }> };
    const mvp1 = parsed.mvps.find((m) => m.id === 'mvp-1');
    expect(mvp1?.status).toBe('done');

    const emitted = events.find((e: any) => e.kind === 'mvp_progress') as any;
    expect(emitted).toBeDefined();
    expect(emitted.mvps.find((m: any) => m.id === 'mvp-1').status).toBe('done');
  });

  it('subsequent upserts update status instead of duplicating rows', async () => {
    await updateMvpsHandler({
      kickoffMeetingId: 'kickoff-1',
      mvps: [
        { id: 'mvp-1', title: 'Core', goal: 'g', status: 'pending', orderIndex: 0 },
      ],
    });
    const second = await updateMvpsHandler({
      kickoffMeetingId: 'kickoff-1',
      mvps: [
        { id: 'mvp-1', title: 'Core', goal: 'g', status: 'in-progress', orderIndex: 0 },
      ],
    });
    const parsed = JSON.parse(second.content[0].text) as { mvps: unknown[] };
    expect(parsed.mvps).toHaveLength(1);
  });
});
