/**
 * capability-registry.ts — Tracks all registered capabilities (built-in + custom).
 *
 * The registry is persisted to ~/.open-coleslaw/registry.json.
 * Built-in capabilities (the 6 hooks + 6 skills that ship with the project) are
 * hardcoded; custom capabilities are added/removed dynamically at runtime.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getConfig } from '../utils/config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CapabilityType = 'hook' | 'skill' | 'command' | 'asset' | 'loop';

export interface Capability {
  type: CapabilityType;
  name: string;
  description: string;
  trigger: string;
  createdAt: number;
  isBuiltIn: boolean;
  filePath: string;
}

// ---------------------------------------------------------------------------
// Built-in capability definitions
// ---------------------------------------------------------------------------

const BUILT_IN_HOOKS: Omit<Capability, 'createdAt'>[] = [
  {
    type: 'hook',
    name: 'pre-read',
    description: 'Loads rules + plugin guide + CLAUDE.md/README before execution',
    trigger: 'Before every execution',
    isBuiltIn: true,
    filePath: 'src/hooks/pre-read.ts',
  },
  {
    type: 'hook',
    name: 'auto-route',
    description: 'Analyzes user prompts and auto-routes to appropriate skill/agent',
    trigger: 'On every user prompt',
    isBuiltIn: true,
    filePath: 'src/hooks/auto-route.ts',
  },
  {
    type: 'hook',
    name: 'auto-commit',
    description: 'Creates conventional commits after task completion',
    trigger: 'After task completion when git is connected',
    isBuiltIn: true,
    filePath: 'src/hooks/auto-commit.ts',
  },
  {
    type: 'hook',
    name: 'doc-update',
    description: 'Updates CLAUDE.md/README.md after process completion',
    trigger: 'After process completion',
    isBuiltIn: true,
    filePath: 'src/hooks/doc-update.ts',
  },
  {
    type: 'hook',
    name: 'flow-verify',
    description: 'Verifies PRD user flows after development',
    trigger: 'After development phase completes',
    isBuiltIn: true,
    filePath: 'src/hooks/flow-verify.ts',
  },
  {
    type: 'hook',
    name: 'mvp-cycle',
    description: 'Triggers re-meeting on verification failure',
    trigger: 'When flow-verify reports failure',
    isBuiltIn: true,
    filePath: 'src/hooks/mvp-cycle.ts',
  },
];

const BUILT_IN_SKILLS: Omit<Capability, 'createdAt'>[] = [
  {
    type: 'skill',
    name: 'meeting',
    description: 'Start a meeting (auto-selects leaders if topic given)',
    trigger: '/meeting [topic]',
    isBuiltIn: true,
    filePath: 'src/skills/meeting.ts',
  },
  {
    type: 'skill',
    name: 'status',
    description: 'Show current meetings, agents, and pending mentions',
    trigger: '/status',
    isBuiltIn: true,
    filePath: 'src/skills/status.ts',
  },
  {
    type: 'skill',
    name: 'dashboard',
    description: 'Open web dashboard at http://localhost:35143',
    trigger: '/dashboard',
    isBuiltIn: true,
    filePath: 'src/skills/dashboard.ts',
  },
  {
    type: 'skill',
    name: 'mention',
    description: 'View and respond to pending @mentions',
    trigger: '/mention',
    isBuiltIn: true,
    filePath: 'src/skills/mention.ts',
  },
  {
    type: 'skill',
    name: 'agents',
    description: 'Show full agent hierarchy tree',
    trigger: '/agents',
    isBuiltIn: true,
    filePath: 'src/skills/agents.ts',
  },
  {
    type: 'skill',
    name: 'minutes',
    description: 'View meeting minutes',
    trigger: '/minutes [meetingId]',
    isBuiltIn: true,
    filePath: 'src/skills/minutes.ts',
  },
];

// ---------------------------------------------------------------------------
// Registry class
// ---------------------------------------------------------------------------

export class CapabilityRegistry {
  private capabilities: Capability[] = [];
  private registryPath: string;

  constructor() {
    const { DATA_DIR } = getConfig();
    this.registryPath = join(DATA_DIR, 'registry.json');
  }

  /**
   * Load all capabilities: built-in (hardcoded) + custom (from registry.json).
   */
  async loadAll(): Promise<Capability[]> {
    // Start with built-in capabilities (timestamp 0 — they always existed)
    const builtIns: Capability[] = [
      ...BUILT_IN_HOOKS,
      ...BUILT_IN_SKILLS,
    ].map((cap) => ({ ...cap, createdAt: 0 }));

    // Merge in custom capabilities from persistent storage
    const custom = this.readCustomEntries();
    this.capabilities = [...builtIns, ...custom];
    return this.capabilities;
  }

  /**
   * Register a new custom capability and persist.
   */
  async register(cap: Omit<Capability, 'createdAt'>): Promise<void> {
    const entry: Capability = { ...cap, createdAt: Date.now() };

    // Remove any existing entry with the same name to avoid duplicates
    const custom = this.readCustomEntries().filter((c) => c.name !== cap.name);
    custom.push(entry);
    this.writeCustomEntries(custom);

    // Refresh in-memory list
    await this.loadAll();
  }

  /**
   * Unregister a custom capability and persist.
   */
  async unregister(type: CapabilityType, name: string): Promise<void> {
    const custom = this.readCustomEntries().filter(
      (c) => !(c.type === type && c.name === name),
    );
    this.writeCustomEntries(custom);

    // Refresh in-memory list
    await this.loadAll();
  }

  /**
   * Find capabilities by type.
   */
  findByType(type: CapabilityType): Capability[] {
    return this.capabilities.filter((c) => c.type === type);
  }

  /**
   * Find a capability by name.
   */
  findByName(name: string): Capability | undefined {
    return this.capabilities.find((c) => c.name === name);
  }

  /**
   * Check whether a capability with the given name exists.
   */
  has(name: string): boolean {
    return this.capabilities.some((c) => c.name === name);
  }

  /**
   * Format all capabilities as a human-readable list suitable for plugin-guide.md.
   */
  formatForGuide(): string {
    const sections: string[] = [];

    const types: CapabilityType[] = ['hook', 'skill', 'command', 'asset', 'loop'];
    for (const type of types) {
      const caps = this.findByType(type);
      if (caps.length === 0) continue;

      const label = type.charAt(0).toUpperCase() + type.slice(1) + 's';
      const lines = caps.map((c) => {
        const tag = c.isBuiltIn ? '' : ' [custom]';
        return `- **${c.name}**${tag} — ${c.description} (trigger: ${c.trigger})`;
      });
      sections.push(`### ${label}\n${lines.join('\n')}`);
    }

    return sections.join('\n\n');
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private readCustomEntries(): Capability[] {
    if (!existsSync(this.registryPath)) {
      return [];
    }
    try {
      const raw = readFileSync(this.registryPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as Capability[];
    } catch {
      return [];
    }
  }

  private writeCustomEntries(entries: Capability[]): void {
    writeFileSync(this.registryPath, JSON.stringify(entries, null, 2), 'utf-8');
  }
}
