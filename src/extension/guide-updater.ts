/**
 * guide-updater.ts — Updates plugin-guide.md and rules.md when capabilities change.
 *
 * Regenerates plugin-guide.md with the current set of capabilities.
 * For rules.md, only appends custom rules — never removes base rules.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfig } from '../utils/config.js';
import type { CapabilityRegistry } from './capability-registry.js';

// ---------------------------------------------------------------------------
// Plugin guide
// ---------------------------------------------------------------------------

/**
 * Regenerate plugin-guide.md with the current set of registered capabilities.
 *
 * The guide is written to ~/.open-coleslaw/plugin-guide.md where the pre-read
 * hook picks it up.
 */
export async function updatePluginGuide(
  registry: CapabilityRegistry,
): Promise<void> {
  const { DATA_DIR } = getConfig();
  const guidePath = join(DATA_DIR, 'plugin-guide.md');

  const capSection = registry.formatForGuide();

  const guide = [
    '# Open-Coleslaw Plugin Guide',
    '',
    '## Overview',
    'Multi-agent orchestrator for Claude Code. Flat dispatch:',
    'main Claude session (meeting runner) -> specialist subagents (per speaker turn) -> worker subagents (parallel).',
    '',
    '## Registered Capabilities',
    '',
    capSection,
    '',
    '## Agent Tiers',
    '| Tier | Model | Role |',
    '|------|-------|------|',
    '| Meeting runner (main session) | user\'s Claude Code model | Dispatches everyone |',
    '| Specialist subagent           | inherits                 | One per speaker turn |',
    '| Worker subagent               | inherits                 | One per parallel task |',
    '',
    'No model is hard-coded — every agent runs on the model configured in the',
    'user\'s Claude Code session.',
    '',
    '## Departments',
    '- Planning: meeting facilitation, MVP decomposition, consensus',
    '- Architecture: system design, API, schema',
    '- Engineering: implementation, code quality',
    '- Verification: testing, security, performance, post-impl verification',
    '- Product: requirements, user stories',
    '- Research: codebase exploration, docs',
    '',
    '## Meeting Minutes',
    'Saved to: ~/.open-coleslaw/minutes/',
    'Index: ~/.open-coleslaw/minutes/INDEX.md',
    'Format: PRD with frontmatter metadata + tags',
    '',
    '## Extension System',
    'Custom capabilities are stored in ~/.open-coleslaw/custom-{type}s/.',
    'Use the `create-capability` MCP tool to add new hooks, skills, commands, assets, or loops.',
    'Registry: ~/.open-coleslaw/registry.json',
    '',
  ].join('\n');

  writeFileSync(guidePath, guide, 'utf-8');
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** Sentinel that marks the beginning of the custom-rules block. */
const CUSTOM_RULES_START = '## Custom Rules';
const CUSTOM_RULES_END = '<!-- /custom-rules -->';

/**
 * Append custom rules to rules.md without removing any base rules.
 *
 * Custom rules are bracketed between a `## Custom Rules` heading and
 * a closing HTML comment so they can be cleanly replaced on subsequent calls.
 */
export async function updateRulesIfNeeded(
  customRules: string[],
): Promise<void> {
  if (customRules.length === 0) return;

  const { DATA_DIR } = getConfig();
  const rulesPath = join(DATA_DIR, 'rules.md');

  let existing: string;
  try {
    existing = readFileSync(rulesPath, 'utf-8');
  } catch {
    // If no rules.md yet, start from an empty document
    existing = '';
  }

  // Strip any previous custom-rules block
  const startIdx = existing.indexOf(CUSTOM_RULES_START);
  const endIdx = existing.indexOf(CUSTOM_RULES_END);
  let base: string;
  if (startIdx !== -1 && endIdx !== -1) {
    base =
      existing.slice(0, startIdx).trimEnd() +
      '\n' +
      existing.slice(endIdx + CUSTOM_RULES_END.length).trimStart();
  } else if (startIdx !== -1) {
    base = existing.slice(0, startIdx).trimEnd();
  } else {
    base = existing;
  }

  // Build the new custom-rules section
  const rulesBlock = [
    '',
    CUSTOM_RULES_START,
    ...customRules.map((r) => `- ${r}`),
    CUSTOM_RULES_END,
  ].join('\n');

  const updated = base.trimEnd() + '\n' + rulesBlock + '\n';
  writeFileSync(rulesPath, updated, 'utf-8');
}
