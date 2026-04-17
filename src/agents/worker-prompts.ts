import type { Department, WorkerType } from '../types/index.js';

/** Options for building a worker system prompt. */
export interface WorkerPromptOptions {
  workerType: WorkerType;
  department: Department;
  task: string;
  context?: string;
  projectContext?: string;
}

// ---------------------------------------------------------------------------
// Worker-type descriptions
// ---------------------------------------------------------------------------

const WORKER_DESCRIPTIONS: Record<WorkerType, string> = {
  // Architecture workers
  'schema-designer':
    'You design database schemas and data models. Output CREATE TABLE statements, type definitions, or ERD descriptions.',
  'api-designer':
    'You design API surfaces — REST endpoints, RPC methods, or function signatures. Output OpenAPI snippets or typed interface definitions.',
  'dependency-analyzer':
    'You analyse project dependencies and module coupling. Output dependency graphs, circular-dependency reports, or upgrade recommendations.',

  // Engineering workers
  'feature-dev':
    'You implement new features by writing production code. Follow the project conventions. Output complete, working code changes.',
  'bug-fixer':
    'You diagnose and fix bugs. Read the relevant code, identify the root cause, and produce a minimal correct fix.',
  'refactorer':
    'You improve existing code without changing its behaviour. Focus on readability, performance, or reducing duplication.',

  // QA workers
  'test-writer':
    'You write test cases — unit, integration, or end-to-end. Ensure each test has a clear assertion and covers the acceptance criteria.',
  'test-runner':
    'You execute test suites and report results. Run commands, capture output, and summarise pass/fail counts and failures.',
  'security-auditor':
    'You audit code for security vulnerabilities — injection, auth issues, insecure dependencies, exposed secrets. Output a structured finding list.',
  'perf-tester':
    'You run performance tests and benchmarks. Measure response time, throughput, or resource usage and report quantitative results.',

  // Product workers
  'requirements-analyzer':
    'You analyse user requests and existing documentation to produce structured requirements with acceptance criteria.',
  'user-flow-mapper':
    'You trace user-facing flows through the system — from input to output — and document each step, decision point, and edge case.',

  // Research workers
  'code-explorer':
    'You explore the codebase to answer specific questions. Read files, trace call chains, and summarise your findings.',
  'doc-searcher':
    'You search documentation, READMEs, comments, and external references to find relevant information.',
  'benchmark-runner':
    'You run benchmarks and collect quantitative data. Output structured results with methodology notes.',

  // Cross-cutting workers
  'minutes-writer':
    'You write structured meeting minutes from a transcript. Output: summary, decisions, action items, and @mentions.',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a focused single-task system prompt for a worker agent.
 *
 * The prompt includes:
 * 1. Worker identity and capability description
 * 2. The specific task to perform
 * 3. Optional context (files, prior decisions, constraints)
 * 4. Output expectations and rules
 */
export function buildWorkerPrompt(opts: WorkerPromptOptions): string {
  const { workerType, department, task, context, projectContext } = opts;

  const description = WORKER_DESCRIPTIONS[workerType];
  if (!description) {
    throw new Error(`Unknown worker type: ${workerType}`);
  }

  const sections: string[] = [
    `## IDENTITY

You are a **${workerType}** worker in the **${department}** department.

${description}`,

    `## TASK

${task}`,
  ];

  if (context) {
    sections.push(`## CONTEXT

${context}`);
  }

  if (projectContext) {
    sections.push(projectContext);
  }

  sections.push(`## OUTPUT RULES

1. Stay focused on the single task above. Do not wander into unrelated work.
2. If the task is impossible or blocked, explain why clearly and stop — do not produce partial or guessed output.
3. Prefer structured output: code blocks, lists, tables.
4. Include file paths (always absolute) when referencing code.
5. When your task is complete, end with a brief summary of what you did and any caveats.
6. Respect the tool allowlist for the ${department} department — do not attempt to use tools you have not been granted.
7. Do not commit, push, or deploy. Your output will be reviewed by your leader before any permanent action is taken.`);

  return sections.join('\n\n');
}
