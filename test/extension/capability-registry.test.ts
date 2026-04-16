/**
 * Tests for src/extension/capability-registry.ts
 *
 * The CapabilityRegistry reads/writes a registry.json file and maintains an
 * in-memory list of built-in + custom capabilities.  We mock `node:fs` and
 * `../utils/config.js` so that no real filesystem I/O occurs.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// In-memory store that replaces the filesystem.
let fakeFs: Record<string, string> = {};

vi.mock('node:fs', () => ({
  readFileSync: (path: string) => {
    if (!(path in fakeFs)) {
      const err = new Error(`ENOENT: no such file or directory, open '${path}'`) as NodeJS.ErrnoException;
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
// Import under test (after mocks are installed)
// ---------------------------------------------------------------------------

const { CapabilityRegistry } = await import('../../src/extension/capability-registry.js');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CapabilityRegistry', () => {
  let registry: InstanceType<typeof CapabilityRegistry>;

  beforeEach(() => {
    fakeFs = {};
    registry = new CapabilityRegistry();
  });

  // ---- loadAll -----------------------------------------------------------

  it('loadAll returns built-in hooks and skills', async () => {
    const caps = await registry.loadAll();

    // There are 6 built-in hooks and 6 built-in skills (12 total).
    const hooks = caps.filter((c) => c.type === 'hook');
    const skills = caps.filter((c) => c.type === 'skill');

    expect(hooks.length).toBe(6);
    expect(skills.length).toBe(6);
    expect(caps.length).toBeGreaterThanOrEqual(12);

    // Every built-in has createdAt === 0.
    for (const cap of caps) {
      expect(cap.isBuiltIn).toBe(true);
      expect(cap.createdAt).toBe(0);
    }
  });

  // ---- register ----------------------------------------------------------

  it('register adds a custom capability and persists it', async () => {
    await registry.loadAll();

    await registry.register({
      type: 'command',
      name: 'my-cmd',
      description: 'A test command',
      trigger: '/my-cmd',
      isBuiltIn: false,
      filePath: '/tmp/fake-open-coleslaw/custom-commands/my-cmd.js',
    });

    // The in-memory list should now contain the custom capability.
    const found = registry.findByName('my-cmd');
    expect(found).toBeDefined();
    expect(found!.type).toBe('command');
    expect(found!.isBuiltIn).toBe(false);
    expect(found!.createdAt).toBeGreaterThan(0);

    // The filesystem should have the persisted JSON.
    const raw = fakeFs['/tmp/fake-open-coleslaw/registry.json'];
    expect(raw).toBeDefined();
    const persisted = JSON.parse(raw);
    expect(Array.isArray(persisted)).toBe(true);
    expect(persisted.some((c: any) => c.name === 'my-cmd')).toBe(true);
  });

  // ---- findByType --------------------------------------------------------

  it('findByType("hook") returns hook capabilities', async () => {
    await registry.loadAll();
    const hooks = registry.findByType('hook');

    expect(hooks.length).toBe(6);
    for (const h of hooks) {
      expect(h.type).toBe('hook');
    }
  });

  // ---- findByName --------------------------------------------------------

  it('findByName("pre-read") returns the pre-read hook', async () => {
    await registry.loadAll();
    const cap = registry.findByName('pre-read');

    expect(cap).toBeDefined();
    expect(cap!.name).toBe('pre-read');
    expect(cap!.type).toBe('hook');
    expect(cap!.isBuiltIn).toBe(true);
  });

  // ---- has ---------------------------------------------------------------

  it('has("pre-read") is true', async () => {
    await registry.loadAll();
    expect(registry.has('pre-read')).toBe(true);
  });

  it('has("nonexistent") is false', async () => {
    await registry.loadAll();
    expect(registry.has('nonexistent')).toBe(false);
  });

  // ---- unregister --------------------------------------------------------

  it('unregister removes a custom capability', async () => {
    await registry.loadAll();

    // First register one.
    await registry.register({
      type: 'command',
      name: 'temp-cmd',
      description: 'Temporary',
      trigger: '/temp',
      isBuiltIn: false,
      filePath: '/tmp/fake-open-coleslaw/custom-commands/temp-cmd.js',
    });

    expect(registry.has('temp-cmd')).toBe(true);

    // Now unregister.
    await registry.unregister('command', 'temp-cmd');

    expect(registry.has('temp-cmd')).toBe(false);

    // Verify persistence removed it.
    const raw = fakeFs['/tmp/fake-open-coleslaw/registry.json'];
    const persisted = JSON.parse(raw);
    expect(persisted.some((c: any) => c.name === 'temp-cmd')).toBe(false);
  });

  // ---- formatForGuide ----------------------------------------------------

  it('formatForGuide includes all built-in capability sections', async () => {
    await registry.loadAll();
    const guide = registry.formatForGuide();

    expect(guide).toContain('### Hooks');
    expect(guide).toContain('### Skills');
    expect(guide).toContain('**pre-read**');
    expect(guide).toContain('**meeting**');
  });
});
