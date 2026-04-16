import type { Department, LeaderRole, WorkerType } from '../types/index.js';
import { DEPARTMENT_TOOLS } from '../types/index.js';

/** Full metadata for a department. */
export interface DepartmentInfo {
  name: Department;
  description: string;
  leaderRole: LeaderRole;
  workerTypes: WorkerType[];
  allowedTools: string[];
}

const DEPARTMENT_REGISTRY: ReadonlyMap<Department, DepartmentInfo> = new Map<Department, DepartmentInfo>([
  [
    'architecture',
    {
      name: 'architecture',
      description:
        'Responsible for system design, schema definitions, API surface design, and dependency analysis. ' +
        'The architecture department plans before code is written — it produces blueprints, not implementations.',
      leaderRole: 'arch-leader',
      workerTypes: ['schema-designer', 'api-designer', 'dependency-analyzer'],
      allowedTools: DEPARTMENT_TOOLS.architecture,
    },
  ],
  [
    'engineering',
    {
      name: 'engineering',
      description:
        'Responsible for writing, modifying, and refactoring production code. ' +
        'Engineering owns feature development, bug fixes, and code quality improvements.',
      leaderRole: 'eng-leader',
      workerTypes: ['feature-dev', 'bug-fixer', 'refactorer'],
      allowedTools: DEPARTMENT_TOOLS.engineering,
    },
  ],
  [
    'qa',
    {
      name: 'qa',
      description:
        'Responsible for test creation, test execution, security auditing, and performance testing. ' +
        'QA ensures deliverables meet acceptance criteria and do not introduce regressions.',
      leaderRole: 'qa-leader',
      workerTypes: ['test-writer', 'test-runner', 'security-auditor', 'perf-tester'],
      allowedTools: DEPARTMENT_TOOLS.qa,
    },
  ],
  [
    'product',
    {
      name: 'product',
      description:
        'Responsible for requirements analysis, user-flow mapping, and stakeholder alignment. ' +
        'Product translates user intent into well-scoped, actionable requirements for other departments.',
      leaderRole: 'pm-leader',
      workerTypes: ['requirements-analyzer', 'user-flow-mapper'],
      allowedTools: DEPARTMENT_TOOLS.product,
    },
  ],
  [
    'research',
    {
      name: 'research',
      description:
        'Responsible for codebase exploration, documentation search, benchmarking, and knowledge gathering. ' +
        'Research produces facts and context that inform decisions made by other departments.',
      leaderRole: 'research-leader',
      workerTypes: ['code-explorer', 'doc-searcher', 'benchmark-runner'],
      allowedTools: DEPARTMENT_TOOLS.research,
    },
  ],
]);

/** Reverse lookup: leader role → department. */
const ROLE_TO_DEPARTMENT: ReadonlyMap<LeaderRole, Department> = new Map<LeaderRole, Department>(
  [...DEPARTMENT_REGISTRY.values()].map((d) => [d.leaderRole, d.name]),
);

/**
 * Get the full metadata for a single department.
 * Throws if the department key is unknown.
 */
export function getDepartment(dept: Department): DepartmentInfo {
  const info = DEPARTMENT_REGISTRY.get(dept);
  if (!info) {
    throw new Error(`Unknown department: ${dept}`);
  }
  return info;
}

/**
 * Return metadata for every registered department.
 */
export function getAllDepartments(): DepartmentInfo[] {
  return [...DEPARTMENT_REGISTRY.values()];
}

/**
 * Resolve a leader role back to its owning department.
 * Throws if the role is unknown.
 */
export function getDepartmentForRole(role: LeaderRole): Department {
  const dept = ROLE_TO_DEPARTMENT.get(role);
  if (dept === undefined) {
    throw new Error(`Unknown leader role: ${role}`);
  }
  return dept;
}
