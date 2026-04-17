/**
 * Unit tests for the minutes hydrator. Writes temp markdown files that mimic
 * real planner-synthesized minutes and asserts that the parser recovers the
 * fields the dashboard actually displays.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { hydratePastMeetings } = await import('../../src/dashboard/minutes-hydrator.js');

let root: string;
let dir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'coleslaw-hydrator-'));
  dir = join(root, 'docs', 'open-coleslaw');
  mkdirSync(dir, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('hydratePastMeetings', () => {
  it('returns [] when the minutes directory does not exist', async () => {
    const out = await hydratePastMeetings('/no/such/path');
    expect(out).toEqual([]);
  });

  it('returns [] when the directory exists but has no md files', async () => {
    const out = await hydratePastMeetings(root);
    expect(out).toEqual([]);
  });

  it('skips INDEX.md and dotfiles', async () => {
    writeFileSync(join(dir, 'INDEX.md'), '# Index\n- (none)');
    writeFileSync(join(dir, '.pending-comments.jsonl'), '{}');
    const out = await hydratePastMeetings(root);
    expect(out).toEqual([]);
  });

  it('parses a kickoff minutes file with standard fields', async () => {
    writeFileSync(
      join(dir, '2026-04-17_kickoff_balance-game.md'),
      [
        '# Meeting Minutes — Kickoff',
        '',
        '- **Topic:** 밸런스게임 웹앱 MVP 분해',
        '- **Date:** 2026-04-17',
        '- **MeetingId:** 10ab3d45-2e26-401d-8706-d99b7d08dada',
        '- **Participants:** planner, product-manager',
        '',
        '## Agenda',
        '1. 사용자 요청을 MVP로 분해',
        '2. MVP 우선순위 정하기',
        '',
        '## Decisions',
        '- Next.js + Tailwind 스택으로 진행',
        '- 5개 MVP로 분해',
        '',
        '## Action Items',
        '- [ ] MVP-1 디자인 미팅 소집',
        '',
      ].join('\n'),
    );

    const out = await hydratePastMeetings(root);
    expect(out).toHaveLength(1);
    expect(out[0].meetingId).toBe('10ab3d45-2e26-401d-8706-d99b7d08dada');
    expect(out[0].meetingType).toBe('kickoff');
    expect(out[0].topic).toBe('밸런스게임 웹앱 MVP 분해');
    expect(out[0].participants).toEqual(['planner', 'product-manager']);
    expect(out[0].decisions).toContain('Next.js + Tailwind 스택으로 진행');
    expect(out[0].actionItems).toContain('MVP-1 디자인 미팅 소집');
    expect(out[0].agenda.length).toBeGreaterThan(0);
    expect(out[0].status).toBe('completed');
  });

  it('infers design meeting type from filename pattern _NNN_', async () => {
    writeFileSync(
      join(dir, '2026-04-17_001_mvp1-core-play.md'),
      '# Meeting Minutes — Design\n- **Topic:** MVP-1\n- **MeetingId:** abc\n',
    );
    const out = await hydratePastMeetings(root);
    expect(out[0].meetingType).toBe('design');
  });

  it('sorts newest first by date prefix', async () => {
    writeFileSync(
      join(dir, '2026-04-15_kickoff_a.md'),
      '# Meeting Minutes — Kickoff\n- **Topic:** older\n- **MeetingId:** a\n',
    );
    writeFileSync(
      join(dir, '2026-04-17_kickoff_b.md'),
      '# Meeting Minutes — Kickoff\n- **Topic:** newer\n- **MeetingId:** b\n',
    );
    const out = await hydratePastMeetings(root);
    expect(out).toHaveLength(2);
    expect(out[0].topic).toBe('newer');
    expect(out[1].topic).toBe('older');
  });

  it('falls back to filename when topic field is missing', async () => {
    writeFileSync(
      join(dir, '2026-04-17_kickoff_orphan.md'),
      '## Some random section\nNo frontmatter at all.\n',
    );
    const out = await hydratePastMeetings(root);
    expect(out).toHaveLength(1);
    // Must still produce a usable thread stub; topic falls back to filename
    expect(out[0].topic.length).toBeGreaterThan(0);
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      writeFileSync(
        join(dir, `2026-04-1${i}_kickoff_${i}.md`),
        `# Meeting Minutes — Kickoff\n- **Topic:** m${i}\n- **MeetingId:** m${i}\n`,
      );
    }
    const out = await hydratePastMeetings(root, 3);
    expect(out).toHaveLength(3);
  });
});
