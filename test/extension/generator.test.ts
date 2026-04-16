/**
 * Tests for src/extension/generator.ts
 *
 * The generator writes files to disk, so we mock `node:fs` and the config
 * module to avoid filesystem side-effects.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let fakeFs: Record<string, string> = {};

vi.mock('node:fs', () => ({
  readFileSync: (path: string) => {
    if (!(path in fakeFs)) {
      const err = new Error(`ENOENT`) as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    }
    return fakeFs[path];
  },
  writeFileSync: (path: string, data: string) => {
    fakeFs[path] = data;
  },
  existsSync: (path: string) => path in fakeFs,
  mkdirSync: () => {},
}));

vi.mock('../../src/utils/config.js', () => ({
  getConfig: () => ({
    DATA_DIR: '/tmp/fake-open-coleslaw',
    DB_PATH: '/tmp/fake-open-coleslaw/data.db',
    MINUTES_DIR: '/tmp/fake-open-coleslaw/minutes',
    DASHBOARD_PORT: 35143,
  }),
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

const { generateCapability } = await import('../../src/extension/generator.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    type: 'hook' as const,
    name: 'test-hook',
    description: 'A test hook',
    trigger: 'on-test',
    userRequest: 'Generate a test hook',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateCapability', () => {
  beforeEach(() => {
    fakeFs = {};
  });

  // ---- hook ---------------------------------------------------------------

  it('generates a hook with proper template', () => {
    const result = generateCapability(makeRequest({ type: 'hook', name: 'my-hook' }));

    expect(result.filePath).toContain('custom-hooks');
    expect(result.filePath).toMatch(/\.js$/);
    expect(result.code).toContain('function main()');
    expect(result.code).toContain("hook: 'my-hook'");

    // Verify header comment includes metadata.
    expect(result.code).toContain('// Name: my-hook');
    expect(result.code).toContain('// Description: A test hook');
    expect(result.code).toContain('// Trigger: on-test');
    expect(result.code).toContain('// Created:');

    // Registry entry should be well-formed.
    expect(result.registryEntry.type).toBe('hook');
    expect(result.registryEntry.name).toBe('my-hook');
    expect(result.registryEntry.isBuiltIn).toBe(false);
  });

  // ---- skill --------------------------------------------------------------

  it('generates a skill with prompt generator function', () => {
    const result = generateCapability(
      makeRequest({ type: 'skill', name: 'my-skill', description: 'Skill desc' }),
    );

    expect(result.filePath).toContain('custom-skills');
    expect(result.filePath).toMatch(/\.js$/);
    expect(result.code).toContain('export function getMySkillSkillPrompt');
    expect(result.code).toContain('<command-name>my-skill</command-name>');

    // Header
    expect(result.code).toContain('// Name: my-skill');
    expect(result.code).toContain('// Description: Skill desc');
  });

  // ---- asset (JSON) -------------------------------------------------------

  it('generates a JSON asset for non-doc names', () => {
    const result = generateCapability(
      makeRequest({
        type: 'asset',
        name: 'my-config',
        description: 'A configuration asset',
      }),
    );

    expect(result.filePath).toContain('custom-assets');
    expect(result.filePath).toMatch(/\.json$/);

    // Parse the generated JSON.
    const parsed = JSON.parse(result.code);
    expect(parsed._meta).toBeDefined();
    expect(parsed._meta.name).toBe('my-config');
    expect(parsed._meta.description).toBe('A configuration asset');
    expect(parsed._meta.generatedBy).toBe('open-coleslaw extension system');
    expect(parsed.config).toBeDefined();
  });

  // ---- asset (Markdown) ---------------------------------------------------

  it('generates a Markdown asset for doc-like names', () => {
    const result = generateCapability(
      makeRequest({
        type: 'asset',
        name: 'setup-guide',
        description: 'A setup guide document',
      }),
    );

    expect(result.filePath).toContain('custom-assets');
    expect(result.filePath).toMatch(/\.md$/);
    expect(result.code).toContain('# setup-guide');
    expect(result.code).toContain('A setup guide document');
    expect(result.code).toContain('<!-- Name: setup-guide -->');
  });

  // ---- command ------------------------------------------------------------

  it('generates a command with handler structure', () => {
    const result = generateCapability(
      makeRequest({ type: 'command', name: 'my-cmd' }),
    );

    expect(result.filePath).toContain('custom-commands');
    expect(result.filePath).toMatch(/\.js$/);
    expect(result.code).toContain('process.argv.slice(2)');
    expect(result.code).toContain("command: 'my-cmd'");
    expect(result.code).toContain('// Name: my-cmd');
  });

  // ---- loop ---------------------------------------------------------------

  it('generates a loop with interval and iteration logic', () => {
    const result = generateCapability(
      makeRequest({ type: 'loop', name: 'my-loop' }),
    );

    expect(result.filePath).toContain('custom-loops');
    expect(result.filePath).toMatch(/\.js$/);
    expect(result.code).toContain('INTERVAL_MS');
    expect(result.code).toContain('MAX_ITERATIONS');
    expect(result.code).toContain("loop: 'my-loop'");
    expect(result.code).toContain('// Name: my-loop');
  });

  // ---- file written to fake FS -------------------------------------------

  it('writes the generated code to the filesystem', () => {
    const result = generateCapability(makeRequest({ type: 'hook', name: 'written-hook' }));

    // The code should be persisted in fakeFs at the returned filePath.
    expect(fakeFs[result.filePath]).toBeDefined();
    expect(fakeFs[result.filePath]).toBe(result.code);
  });
});
