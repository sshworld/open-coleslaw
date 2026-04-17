export type AgentTier = 'orchestrator' | 'leader' | 'worker';

export type AgentStatus =
  | 'idle'
  | 'in-meeting'
  | 'working'
  | 'spawning-workers'
  | 'aggregating'
  | 'waiting-for-user'
  | 'completed'
  | 'failed';

export type Department =
  | 'planning'
  | 'architecture'
  | 'engineering'
  | 'verification'
  | 'product'
  | 'research';

export type LeaderRole =
  | 'planner'
  | 'architect'
  | 'engineer'
  | 'verifier'
  | 'product-manager'
  | 'researcher';

export type WorkerType =
  | 'schema-designer'
  | 'api-designer'
  | 'dependency-analyzer'
  | 'feature-dev'
  | 'bug-fixer'
  | 'refactorer'
  | 'test-writer'
  | 'test-runner'
  | 'security-auditor'
  | 'perf-tester'
  | 'requirements-analyzer'
  | 'user-flow-mapper'
  | 'code-explorer'
  | 'doc-searcher'
  | 'benchmark-runner'
  | 'minutes-writer';

export interface AgentNode {
  id: string;
  tier: AgentTier;
  role: string;
  department: Department;
  parentId: string | null;
  meetingId: string | null;
  status: AgentStatus;
  currentTask: string | null;
  sessionId: string | null;
  spawnedAt: number;
  completedAt: number | null;
  costUsd: number;
}

export interface AgentConfig {
  /**
   * Optional. Empty string or missing means "inherit from the calling session".
   * In the current architecture (agents dispatched via Claude Code Agent tool)
   * models are inherited from the user's session — not hard-coded.
   */
  model?: string;
  maxTurns: number;

  allowedTools: string[];
}

/**
 * Per-tier runtime caps. Model is intentionally omitted — every agent inherits
 * the model from the user's Claude Code session (see agents/*.md frontmatter
 * `model: inherit`). Only turn-budget remains.
 */
export const TIER_CONFIGS: Record<AgentTier, Omit<AgentConfig, 'allowedTools'>> = {
  orchestrator: {
    maxTurns: 10,
  },
  leader: {
    maxTurns: 20,
  },
  worker: {
    maxTurns: 30,
  },
};

export const DEPARTMENT_TOOLS: Record<Department, string[]> = {
  planning: ['Read'],
  architecture: ['Read', 'Grep', 'Glob'],
  engineering: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'],
  verification: ['Read', 'Grep', 'Glob', 'Bash'],
  product: ['Read'],
  research: ['Read', 'Grep', 'Glob', 'WebSearch'],
};

export const ROLE_TO_DEPARTMENT: Record<LeaderRole, Department> = {
  planner: 'planning',
  architect: 'architecture',
  engineer: 'engineering',
  verifier: 'verification',
  'product-manager': 'product',
  researcher: 'research',
};
