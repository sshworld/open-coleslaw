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
  | 'architecture'
  | 'engineering'
  | 'qa'
  | 'product'
  | 'research';

export type LeaderRole =
  | 'arch-leader'
  | 'eng-leader'
  | 'qa-leader'
  | 'pm-leader'
  | 'research-leader';

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
  | 'minutes-writer'
  | 'compactor';

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
  model: string;
  maxTurns: number;
  maxBudgetUsd: number;
  allowedTools: string[];
}

export const TIER_CONFIGS: Record<AgentTier, Omit<AgentConfig, 'allowedTools'>> = {
  orchestrator: {
    model: 'claude-sonnet-4-6',
    maxTurns: 10,
    maxBudgetUsd: 1.0,
  },
  leader: {
    model: 'claude-sonnet-4-6',
    maxTurns: 20,
    maxBudgetUsd: 2.0,
  },
  worker: {
    model: 'claude-sonnet-4-6',
    maxTurns: 30,
    maxBudgetUsd: 0.5,
  },
};

export const DEPARTMENT_TOOLS: Record<Department, string[]> = {
  architecture: ['Read', 'Grep', 'Glob'],
  engineering: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'],
  qa: ['Read', 'Grep', 'Glob', 'Bash'],
  product: ['Read'],
  research: ['Read', 'Grep', 'Glob', 'WebSearch'],
};
