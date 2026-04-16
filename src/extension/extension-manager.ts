/**
 * extension-manager.ts — Top-level orchestrator for the extension system.
 *
 * Coordinates the CapabilityRegistry, code generator, and guide updater
 * so that the rest of the system has a single entry-point for extension
 * operations.
 */

import { CapabilityRegistry } from './capability-registry.js';
import type {
  CapabilityType,
  Capability,
} from './capability-registry.js';
import { generateCapability } from './generator.js';
import type { GenerateRequest } from './generator.js';
import { updatePluginGuide } from './guide-updater.js';

// ---------------------------------------------------------------------------
// Analysis result
// ---------------------------------------------------------------------------

export interface AnalysisResult {
  needsNewCapability: boolean;
  suggestedType?: CapabilityType;
  suggestedName?: string;
  suggestedDescription?: string;
  suggestedTrigger?: string;
}

// ---------------------------------------------------------------------------
// Creation result
// ---------------------------------------------------------------------------

export interface CreateResult {
  capability: Capability;
  filePath: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Keyword patterns for request analysis
// ---------------------------------------------------------------------------

interface KeywordRule {
  type: CapabilityType;
  patterns: RegExp[];
}

const KEYWORD_RULES: KeywordRule[] = [
  {
    type: 'hook',
    patterns: [
      /\bevery\s+time\b/i,
      /\balways\b/i,
      /\bbefore\s+\w+/i,
      /\bafter\s+\w+/i,
      /\bwhen\s+\w+/i,
      /\bon\s+(every|each)\b/i,
    ],
  },
  {
    type: 'skill',
    patterns: [
      /\/\w+/,
      /\bslash\s+command\b/i,
      /\bshortcut\b/i,
      /\bskill\b/i,
    ],
  },
  {
    type: 'asset',
    patterns: [
      /\btemplate\b/i,
      /\bconfig\b/i,
      /\bsettings\b/i,
      /\bconfiguration\b/i,
    ],
  },
  {
    type: 'loop',
    patterns: [
      /\bcheck\s+every\b/i,
      /\bpoll\b/i,
      /\bwatch\b/i,
      /\bmonitor\b/i,
      /\brepeatedly\b/i,
      /\bperiodically\b/i,
    ],
  },
];

// ---------------------------------------------------------------------------
// ExtensionManager
// ---------------------------------------------------------------------------

export class ExtensionManager {
  private registry: CapabilityRegistry;

  constructor() {
    this.registry = new CapabilityRegistry();
  }

  /**
   * Initialize: load the registry from disk.
   */
  async init(): Promise<void> {
    await this.registry.loadAll();
  }

  /**
   * Analyze a user request to decide whether a new capability is needed.
   *
   * Uses keyword matching to suggest the capability type. Returns
   * `needsNewCapability: false` when the request matches an existing
   * capability name.
   */
  async analyzeRequest(request: string): Promise<AnalysisResult> {
    // If a capability with a matching name already exists, no creation needed
    const normalized = request.toLowerCase().trim();

    for (const cap of await this.registry.loadAll()) {
      if (normalized.includes(cap.name.toLowerCase())) {
        return { needsNewCapability: false };
      }
    }

    // Try to match keyword rules
    for (const rule of KEYWORD_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(request)) {
          const nameCandidate = extractName(request);
          return {
            needsNewCapability: true,
            suggestedType: rule.type,
            suggestedName: nameCandidate,
            suggestedDescription: request.slice(0, 120),
            suggestedTrigger: extractTrigger(request, rule.type),
          };
        }
      }
    }

    // Default: treat as a generic command
    return {
      needsNewCapability: true,
      suggestedType: 'command',
      suggestedName: extractName(request),
      suggestedDescription: request.slice(0, 120),
      suggestedTrigger: 'On user invocation',
    };
  }

  /**
   * Create a new capability, persist it, and update the plugin guide.
   */
  async createCapability(request: GenerateRequest): Promise<CreateResult> {
    // Generate the code file
    const result = generateCapability(request);

    // Register in the capability registry
    await this.registry.register(result.registryEntry);

    // Refresh the plugin guide so pre-read picks it up
    await updatePluginGuide(this.registry);

    // Build the full Capability object to return
    const capability: Capability = {
      ...result.registryEntry,
      createdAt: Date.now(),
    };

    const summary =
      `Created ${request.type} "${request.name}": ${request.description}. ` +
      `File: ${result.filePath}`;

    return { capability, filePath: result.filePath, summary };
  }

  /**
   * List all capabilities (built-in + custom).
   */
  async listCapabilities(): Promise<Capability[]> {
    return this.registry.loadAll();
  }

  /**
   * Remove a custom capability by name.
   *
   * Built-in capabilities cannot be removed.
   */
  async removeCapability(name: string): Promise<void> {
    const cap = this.registry.findByName(name);
    if (!cap) {
      throw new Error(`Capability not found: ${name}`);
    }
    if (cap.isBuiltIn) {
      throw new Error(`Cannot remove built-in capability: ${name}`);
    }

    await this.registry.unregister(cap.type, name);

    // Refresh the plugin guide
    await updatePluginGuide(this.registry);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a reasonable short name from a user request string.
 */
function extractName(request: string): string {
  // Try to pull out a slash-command name like /foo
  const slashMatch = request.match(/\/(\w[\w-]*)/);
  if (slashMatch) return slashMatch[1];

  // Otherwise, take the first few meaningful words
  const words = request
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3);

  return words.join('-').toLowerCase() || 'unnamed';
}

/**
 * Generate a trigger description from the request and inferred type.
 */
function extractTrigger(request: string, type: CapabilityType): string {
  switch (type) {
    case 'hook': {
      const beforeMatch = request.match(/before\s+(\w[\w\s]{0,30})/i);
      if (beforeMatch) return `Before ${beforeMatch[1].trim()}`;
      const afterMatch = request.match(/after\s+(\w[\w\s]{0,30})/i);
      if (afterMatch) return `After ${afterMatch[1].trim()}`;
      const whenMatch = request.match(/when\s+(\w[\w\s]{0,30})/i);
      if (whenMatch) return `When ${whenMatch[1].trim()}`;
      return 'On configured trigger';
    }
    case 'skill':
      return `/${extractName(request)}`;
    case 'loop': {
      const everyMatch = request.match(/every\s+([\w\s]+)/i);
      if (everyMatch) return `Every ${everyMatch[1].trim()}`;
      return 'On interval';
    }
    case 'asset':
      return 'When referenced';
    case 'command':
      return 'On user invocation';
  }
}
