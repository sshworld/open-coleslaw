import type { AgentTier, AgentConfig } from '../types/index.js';
import { TIER_CONFIGS } from '../types/index.js';

/**
 * Valid parent→child relationships in the agent hierarchy.
 *
 *   orchestrator → leader → worker
 *
 * An orchestrator can spawn leaders. A leader can spawn workers.
 * No other parent→child combination is allowed.
 */
const VALID_HIERARCHY: ReadonlyMap<AgentTier, AgentTier> = new Map([
  ['orchestrator', 'leader'],
  ['leader', 'worker'],
]);

/**
 * Returns `true` when `parentTier` is allowed to spawn a child of `childTier`.
 *
 * Rules:
 * - orchestrator → leader  ✔
 * - leader      → worker   ✔
 * - everything else        ✘
 */
export function isValidParent(parentTier: AgentTier, childTier: AgentTier): boolean {
  return VALID_HIERARCHY.get(parentTier) === childTier;
}

/**
 * Look up the tier-level configuration (model, maxTurns, maxBudgetUsd).
 *
 * Returns a copy so callers can safely mutate the result without affecting
 * the shared config.
 */
export function getTierConfig(tier: AgentTier): Omit<AgentConfig, 'allowedTools'> {
  const config = TIER_CONFIGS[tier];
  if (!config) {
    throw new Error(`Unknown agent tier: ${tier}`);
  }
  return { ...config };
}
