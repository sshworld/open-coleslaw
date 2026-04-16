import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MinutesRecord } from '../../src/types/index.js';
import { createTestDb } from '../fixtures/test-db.js';
import type { Database as DatabaseType } from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Mock the DB module so storage functions use the in-memory test DB
// ---------------------------------------------------------------------------

let testDb: DatabaseType;

vi.mock('../../src/storage/db.js', () => ({
  getDb: () => testDb,
  closeDb: () => {},
}));

// Must import AFTER vi.mock so the mock is in effect
const { Compactor } = await import('../../src/meeting/compactor.js');
const { createMinutes } = await import('../../src/storage/minutes-store.js');

describe('Compactor', () => {
  let compactor: InstanceType<typeof Compactor>;

  beforeEach(() => {
    testDb = createTestDb();
    compactor = new Compactor();
  });

  it('throws when no minutes exist for the meeting', async () => {
    await expect(compactor.compactMinutes('nonexistent-meeting')).rejects.toThrow(
      'No minutes found for meeting',
    );
  });

  it('assigns departments and priorities to existing action items', async () => {
    const meetingId = 'meeting-compact-001';

    // Insert minutes with action items
    createMinutes({
      meetingId,
      format: 'prd',
      content: 'Meeting notes about implementing a new schema design.',
      actionItems: [
        {
          id: 'item-1',
          title: 'Implement the login feature',
          description: 'Build the login form and authentication flow. This is a critical feature.',
          assignedDepartment: '',
          assignedRole: '',
          priority: 'medium',
          dependencies: [],
          acceptanceCriteria: ['User can log in', 'Session is persisted'],
        },
        {
          id: 'item-2',
          title: 'Design the database schema for users',
          description: 'Create schema definitions for the user table. High priority architecture work.',
          assignedDepartment: '',
          assignedRole: '',
          priority: 'medium',
          dependencies: [],
          acceptanceCriteria: ['Schema is documented'],
        },
        {
          id: 'item-3',
          title: 'Write test cases for auth',
          description: 'Ensure quality coverage for the authentication module.',
          assignedDepartment: '',
          assignedRole: '',
          priority: 'medium',
          dependencies: [],
          acceptanceCriteria: ['Coverage > 80%'],
        },
      ],
    });

    const result = await compactor.compactMinutes(meetingId);

    expect(result).toHaveLength(3);

    // Item 1: "implement" + "feature" + "critical" => engineering, critical
    const item1 = result.find((i) => i.id === 'item-1')!;
    expect(item1.assignedDepartment).toBe('engineering');
    expect(item1.assignedRole).toBe('eng-leader');
    expect(item1.priority).toBe('critical');

    // Item 2: "schema" + "design" + "architecture" => architecture, high
    const item2 = result.find((i) => i.id === 'item-2')!;
    expect(item2.assignedDepartment).toBe('architecture');
    expect(item2.assignedRole).toBe('arch-leader');
    expect(item2.priority).toBe('high');

    // Item 3: "test" + "quality" + "coverage" => qa
    const item3 = result.find((i) => i.id === 'item-3')!;
    expect(item3.assignedDepartment).toBe('qa');
    expect(item3.assignedRole).toBe('qa-leader');
  });

  it('extracts action items from content when no structured items exist', async () => {
    const meetingId = 'meeting-compact-002';

    createMinutes({
      meetingId,
      format: 'summary',
      content: `## Meeting Summary

### Action Items
- Implement the user registration flow with proper validation
- Research best practices for API rate limiting
- Test the payment processing module for security vulnerabilities
`,
      actionItems: [],
    });

    const result = await compactor.compactMinutes(meetingId);

    expect(result.length).toBeGreaterThanOrEqual(3);

    // Check that departments were assigned
    const departments = result.map((item) => item.assignedDepartment);
    expect(departments).toContain('engineering');
    expect(departments).toContain('research');
    // "security" keyword should map to qa
    expect(departments).toContain('qa');
  });

  it('persists refined action items back to the database', async () => {
    const meetingId = 'meeting-compact-003';

    createMinutes({
      meetingId,
      format: 'prd',
      content: 'Notes',
      actionItems: [
        {
          id: 'persist-item',
          title: 'Build the API endpoint',
          description: 'Implement REST endpoint for user data.',
          assignedDepartment: '',
          assignedRole: '',
          priority: 'medium',
          dependencies: [],
          acceptanceCriteria: [],
        },
      ],
    });

    await compactor.compactMinutes(meetingId);

    // Read back from DB to verify persistence
    const row = testDb
      .prepare('SELECT action_items FROM minutes WHERE meeting_id = ?')
      .get(meetingId) as { action_items: string };
    const persisted = JSON.parse(row.action_items);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].assignedDepartment).toBe('engineering');
  });
});
