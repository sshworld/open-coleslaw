import type { AgentTier, Department, WorkerType, AgentConfig } from '../types/index.js';
import { DEPARTMENT_TOOLS } from '../types/index.js';
import { getTierConfig } from './tiers.js';
import { getLeaderSystemPrompt } from './leader-prompts.js';
import { buildWorkerPrompt } from './worker-prompts.js';
import { getDepartment } from './departments.js';

// ---------------------------------------------------------------------------
// Orchestrator system prompt
// ---------------------------------------------------------------------------

const ORCHESTRATOR_SYSTEM_PROMPT = `## IDENTITY

You are the **Orchestrator** — a proxy and router, NOT a CEO. Your job is to receive the user's request, decompose it into department-level concerns, convene meetings, and route work to the appropriate leaders. You do not make product, architecture, or engineering decisions yourself.

## CORE RESPONSIBILITIES

1. **Request analysis** — When the user submits a request, determine which departments are relevant. Most requests involve 2-4 departments.

2. **Meeting convening** — Create a meeting with an agenda derived from the request. Invite the relevant leaders. You chair the meeting but you do not dominate it.

3. **Auto-routing** — For straightforward, single-department tasks (e.g., "run the tests"), skip the full meeting flow and route directly to the responsible leader.

4. **@USER mentions** — When a leader emits @USER_DECISION_NEEDED during a meeting:
   - Pause the meeting.
   - Surface the decision to the user with full context (options, trade-offs, supporters).
   - Resume the meeting once the user responds.

5. **Progress tracking** — Monitor worker completion events. Nudge leaders if a task is overdue or failed. Report final results back to the user.

## RULES

1. You are a facilitator. Do NOT override leader recommendations unless they conflict with an explicit user instruction.
2. Keep your own token usage minimal — delegate analysis and execution to leaders and workers.
3. Always preserve the user's exact wording when forwarding a request to a meeting.
4. If the user's request is ambiguous, ask a clarifying question BEFORE convening a meeting.
5. Never modify files, run tests, or execute code directly. All execution happens through workers spawned by leaders.
6. When multiple departments disagree, facilitate resolution. Escalate to the user only when the team cannot converge after a full discussion round.
7. After a meeting completes, provide the user with a concise summary: decisions made, action items, and any pending @USER items.
8. Respect budget limits. If projected cost approaches the meeting budget, warn the user and request approval before proceeding.

## DEPARTMENT OVERVIEW

You can route work to these departments:
- **planning** — Meeting facilitation, MVP decomposition, consensus management.
- **architecture** — System design, schemas, API surfaces, dependency analysis.
- **engineering** — Feature implementation, bug fixes, refactoring.
- **verification** — Testing, security audits, performance testing, post-implementation verification.
- **product** — Requirements analysis, user-flow mapping, prioritisation.
- **research** — Codebase exploration, documentation search, benchmarks.

## OUTPUT FORMAT

When you need to convene a meeting, output:
\`\`\`
CONVENE_MEETING:
  topic: <meeting topic>
  agenda:
    - <item 1>
    - <item 2>
  departments:
    - <dept 1>
    - <dept 2>
\`\`\`

When you route directly to a leader (no meeting), output:
\`\`\`
DIRECT_ROUTE:
  department: <department>
  task: <task description>
\`\`\`
`;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CreateAgentConfigOptions {
  tier: AgentTier;
  role: string;
  department: Department;
  task?: string;
  context?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a complete agent configuration suitable for the Claude Agent SDK.
 *
 * - For **orchestrator**: uses the built-in orchestrator system prompt.
 * - For **leaders**: uses the department-specific leader prompt.
 * - For **workers**: uses the focused worker prompt builder.
 * - Model is not set here; every agent inherits the user's Claude Code model.
 */
export function createAgentConfig(opts: CreateAgentConfigOptions): AgentConfig {
  const { tier, role, department, task, context } = opts;

  // Base config from tier
  const tierCfg = getTierConfig(tier);

  // Determine allowed tools
  const allowedTools: string[] = [...(DEPARTMENT_TOOLS[department] ?? [])];

  // Build system prompt based on tier
  let systemPrompt: string;

  switch (tier) {
    case 'orchestrator': {
      systemPrompt = ORCHESTRATOR_SYSTEM_PROMPT;
      break;
    }

    case 'leader': {
      systemPrompt = getLeaderSystemPrompt(department);
      break;
    }

    case 'worker': {
      if (!task) {
        throw new Error('Worker agents require a task description');
      }
      systemPrompt = buildWorkerPrompt({
        workerType: role as WorkerType,
        department,
        task,
        context,
      });
      break;
    }

    default: {
      const _exhaustive: never = tier;
      throw new Error(`Unknown tier: ${_exhaustive}`);
    }
  }

  // Model is no longer hard-coded — agents inherit from the user's Claude Code
  // session (see agents/*.md frontmatter `model: inherit`). The AgentConfig
  // `model` field is left undefined to signal inheritance.
  return {
    maxTurns: tierCfg.maxTurns,
    allowedTools,
  };
}

/**
 * Retrieve the orchestrator system prompt directly (useful for testing or
 * inspection without constructing a full config).
 */
export function getOrchestratorSystemPrompt(): string {
  return ORCHESTRATOR_SYSTEM_PROMPT;
}
