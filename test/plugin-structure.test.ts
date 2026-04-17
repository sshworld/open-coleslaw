/**
 * Structural assertions for the plugin layout.
 *
 * These tests guard against regressions in the agent roster, skill runbook,
 * and version alignment. They cannot verify LLM runtime behavior (whether the
 * main session *actually* dispatches specialists) — that's what the manual
 * smoke-test checklist in `docs/smoke-tests.md` is for. These tests just make
 * sure the static shape of the plugin matches our intent, so that when the
 * runbook says "dispatch planner" the file it points at still exists and has
 * the expected frontmatter.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const AGENTS = join(ROOT, 'agents');
const SKILLS = join(ROOT, 'skills');

const EXPECTED_AGENTS = [
  'planner',
  'architect',
  'engineer',
  'verifier',
  'product-manager',
  'researcher',
  'worker',
];

function readAgent(name: string): string {
  return readFileSync(join(AGENTS, `${name}.md`), 'utf-8');
}

function frontmatter(md: string): Record<string, string> {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const body = m[1];
  const out: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2];
  }
  return out;
}

describe('plugin structure — agent roster', () => {
  it('does NOT include agents/orchestrator.md (removed in v0.6.0)', () => {
    expect(existsSync(join(AGENTS, 'orchestrator.md'))).toBe(false);
  });

  for (const name of EXPECTED_AGENTS) {
    it(`agents/${name}.md exists`, () => {
      expect(existsSync(join(AGENTS, `${name}.md`))).toBe(true);
    });

    it(`agents/${name}.md has frontmatter model: inherit`, () => {
      const fm = frontmatter(readAgent(name));
      expect(fm.model).toBe('inherit');
    });

    it(`agents/${name}.md has a non-empty description in frontmatter`, () => {
      const md = readAgent(name);
      // description may be a folded multi-line value (ends at next key or ---)
      const m = md.match(/description:\s*\|\s*\n((?:\s+.*\n)+)/) ||
                md.match(/description:\s*"([^"]+)"/) ||
                md.match(/description:\s*([^\n]+)/);
      expect(m, `no description field in agents/${name}.md frontmatter`).toBeTruthy();
      expect(m![1].trim().length).toBeGreaterThan(10);
    });
  }
});

describe('plugin structure — skills', () => {
  it('skills/using-open-coleslaw/SKILL.md exists', () => {
    expect(existsSync(join(SKILLS, 'using-open-coleslaw', 'SKILL.md'))).toBe(true);
  });

  it('skills/meeting/SKILL.md exists', () => {
    expect(existsSync(join(SKILLS, 'meeting', 'SKILL.md'))).toBe(true);
  });

  it('using-open-coleslaw skill does NOT reference the removed orchestrator subagent', () => {
    const md = readFileSync(join(SKILLS, 'using-open-coleslaw', 'SKILL.md'), 'utf-8');
    expect(md).not.toMatch(/subagent_type:\s*"open-coleslaw:orchestrator"/);
  });

  it('using-open-coleslaw skill references every specialist by subagent_type', () => {
    const md = readFileSync(join(SKILLS, 'using-open-coleslaw', 'SKILL.md'), 'utf-8');
    for (const role of ['planner', 'architect', 'engineer', 'verifier', 'worker']) {
      expect(
        md.includes(`open-coleslaw:${role}`),
        `skill should reference open-coleslaw:${role}`,
      ).toBe(true);
    }
  });

  it('meeting skill points to the same runbook (no orchestrator dispatch)', () => {
    const md = readFileSync(join(SKILLS, 'meeting', 'SKILL.md'), 'utf-8');
    expect(md).not.toMatch(/subagent_type:\s*"open-coleslaw:orchestrator"/);
  });

  it('using-open-coleslaw skill enforces the auto-loop contract (v0.6.2)', () => {
    const md = readFileSync(join(SKILLS, 'using-open-coleslaw', 'SKILL.md'), 'utf-8');
    // Must tell the runner to auto-loop without asking
    expect(md).toMatch(/Auto-loop/i);
    // Must forbid asking the user for next-MVP permission
    expect(md.toLowerCase()).toMatch(/do not ask/);
    // Must restrict .cycle-complete to the final MVP
    expect(md.toLowerCase()).toMatch(/only after the (final|last) mvp/);
    // Must NOT contain the old loose phrasing that let the model stop between MVPs
    expect(md).not.toMatch(/loop back to Phase 2 with the next MVP\./); // plain version without auto-loop guard
  });

  it('meeting skill propagates the auto-loop instruction', () => {
    const md = readFileSync(join(SKILLS, 'meeting', 'SKILL.md'), 'utf-8');
    expect(md.toLowerCase()).toMatch(/auto-loop|do not prompt|without asking/);
    expect(md.toLowerCase()).toMatch(/only after the (last|final) mvp/);
  });

  it('using-open-coleslaw skill mandates planner in every meeting (v0.6.3)', () => {
    const md = readFileSync(join(SKILLS, 'using-open-coleslaw', 'SKILL.md'), 'utf-8');
    // Mandatory planner language
    expect(md.toLowerCase()).toMatch(/planner is mandatory|mandatory.*planner|planner.*mandatory/);
    // Must state the three dispatch points (opening / consensus / synthesis)
    expect(md.toLowerCase()).toMatch(/opening/);
    expect(md.toLowerCase()).toMatch(/consensus/);
    expect(md.toLowerCase()).toMatch(/synthesis/);
    // Must forbid skipping meetings for "continue with MVP N" prompts
    expect(md).toMatch(/every MVP/i);
    expect(md).toMatch(/its own (full )?design meeting/i);
  });

  it('meeting skill also mandates planner in every meeting', () => {
    const md = readFileSync(join(SKILLS, 'meeting', 'SKILL.md'), 'utf-8');
    expect(md.toLowerCase()).toMatch(/planner is mandatory|mandatory.*planner|planner.*mandatory/);
    expect(md).toMatch(/every MVP/i);
  });
});

describe('plugin structure — version alignment', () => {
  it('package.json, .claude-plugin/plugin.json, and .claude-plugin/marketplace.json all agree on the version', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as { version: string };
    const plg = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf-8')) as { version: string };
    const mkt = JSON.parse(
      readFileSync(join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf-8'),
    ) as { plugins: Array<{ name: string; version: string }> };
    const mktVersion = mkt.plugins.find((p) => p.name === 'open-coleslaw')?.version;

    expect(plg.version).toBe(pkg.version);
    expect(mktVersion).toBe(pkg.version);
  });
});

describe('plugin structure — hooks', () => {
  it('hooks/session-start exists', () => {
    expect(existsSync(join(ROOT, 'hooks', 'session-start'))).toBe(true);
  });

  it('hooks/stop exists', () => {
    expect(existsSync(join(ROOT, 'hooks', 'stop'))).toBe(true);
  });

  it('hooks/hooks.json registers both SessionStart and Stop', () => {
    const cfg = JSON.parse(readFileSync(join(ROOT, 'hooks', 'hooks.json'), 'utf-8')) as {
      hooks: Record<string, unknown>;
    };
    expect(cfg.hooks).toHaveProperty('SessionStart');
    expect(cfg.hooks).toHaveProperty('Stop');
  });
});
