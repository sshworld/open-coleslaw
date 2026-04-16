import { v4 as uuidv4 } from 'uuid';
import type {
  Department,
  Meeting,
  MentionRecord,
} from '../types/index.js';
import {
  createMeeting,
  updateMeeting,
  getMeeting,
  listMeetings,
  listPendingMentions,
  getAgentTree,
  getMinutesByMeeting,
} from '../storage/index.js';
import type { AgentTreeNode } from '../storage/index.js';
import { LeaderPool } from './leader-pool.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Keyword maps for leader selection heuristics
// ---------------------------------------------------------------------------

const DEPARTMENT_KEYWORDS: Record<Department, string[]> = {
  architecture: [
    'architecture', 'design', 'schema', 'api', 'data model', 'module',
    'interface', 'contract', 'coupling', 'dependency graph', 'adr',
    'system design', 'blueprint', 'data flow',
  ],
  engineering: [
    'code', 'implement', 'build', 'feature', 'bug', 'fix', 'refactor',
    'develop', 'function', 'class', 'module', 'write', 'create',
    'modify', 'update', 'delete', 'crud', 'endpoint', 'migration',
  ],
  qa: [
    'test', 'quality', 'security', 'performance', 'audit', 'coverage',
    'regression', 'benchmark', 'vulnerability', 'pen test', 'lint',
    'assertion', 'e2e', 'integration test', 'unit test',
  ],
  product: [
    'requirements', 'user', 'story', 'priority', 'acceptance criteria',
    'user flow', 'stakeholder', 'roadmap', 'scope', 'use case',
    'persona', 'mvp', 'specification',
  ],
  research: [
    'research', 'explore', 'investigate', 'search', 'analyze', 'find',
    'discover', 'benchmark', 'compare', 'survey', 'documentation',
    'reference', 'existing code',
  ],
};

// ---------------------------------------------------------------------------
// StartMeeting options & result
// ---------------------------------------------------------------------------

export interface StartMeetingOptions {
  topic: string;
  agenda: string[];
  departments?: Department[];
  previousMeetingId?: string | null;
}

export interface StartMeetingResult {
  meetingId: string;
  departments: Department[];
  agenda: string[];
  topic: string;
}

// ---------------------------------------------------------------------------
// Orchestrator status
// ---------------------------------------------------------------------------

export interface OrchestratorStatus {
  activeMeetings: Meeting[];
  pendingMentions: MentionRecord[];
  agentTree: AgentTreeNode | null;
}

// ---------------------------------------------------------------------------
// Orchestrator — creates meeting records and selects leaders
//
// No longer runs meetings itself. Meetings are orchestrated by Claude Code's
// Agent tool via skill/agent markdown files.
// ---------------------------------------------------------------------------

export class Orchestrator {
  private readonly leaderPool = new LeaderPool();

  /**
   * Internal ID for the orchestrator "agent". Used as the meeting initiator
   * and as the root of the agent tree.
   */
  private readonly orchestratorId: string;

  constructor(orchestratorId?: string) {
    this.orchestratorId = orchestratorId ?? 'orchestrator-root';
  }

  // ---- leader selection ---------------------------------------------------

  /**
   * Analyse a topic and agenda to determine which department leaders should
   * be convened for a meeting.
   *
   * Uses keyword-based heuristics:
   * - Matches topic + agenda text against per-department keyword lists.
   * - Scores each department by the number of keyword hits.
   * - Selects departments with at least one hit.
   * - Falls back to engineering + architecture for complex topics (multiple
   *   agenda items) or engineering alone for simple ones.
   */
  selectLeaders(topic: string, agenda: string[]): Department[] {
    const corpus = [topic, ...agenda].join(' ').toLowerCase();

    const scores = new Map<Department, number>();

    for (const [dept, keywords] of Object.entries(DEPARTMENT_KEYWORDS) as [Department, string[]][]) {
      let score = 0;
      for (const kw of keywords) {
        if (corpus.includes(kw)) {
          score++;
        }
      }
      if (score > 0) {
        scores.set(dept, score);
      }
    }

    if (scores.size === 0) {
      // Fallback: complex topics (3+ agenda items) get architecture + engineering;
      // simple ones get engineering only.
      if (agenda.length >= 3) {
        logger.debug('No keyword matches; defaulting to architecture + engineering (complex topic)', {
          meetingId: topic,
        });
        return ['architecture', 'engineering'];
      }
      logger.debug('No keyword matches; defaulting to engineering only (simple topic)', {
        meetingId: topic,
      });
      return ['engineering'];
    }

    // Sort by score descending and take all with hits
    const selected = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([dept]) => dept);

    logger.debug(`Selected departments: ${selected.join(', ')}`, { meetingId: topic });

    return selected;
  }

  // ---- start meeting ------------------------------------------------------

  /**
   * Create a new meeting record and return meeting info + recommended leaders.
   *
   * Does NOT run the meeting. The calling agent (via skill markdown) is
   * responsible for orchestrating the meeting phases using add-transcript
   * and generate-minutes MCP tools.
   */
  startMeeting(opts: StartMeetingOptions): StartMeetingResult {
    const { topic, agenda } = opts;
    const departments = opts.departments ?? this.selectLeaders(topic, agenda);

    logger.info(`Creating meeting: "${topic}" with departments: [${departments.join(', ')}]`);

    // Create the meeting record
    const meetingId = uuidv4();
    createMeeting({
      id: meetingId,
      topic,
      agenda,
      participantIds: departments.map((d) => `${d}-leader`),
      initiatedBy: this.orchestratorId,
      status: 'pending',
      phase: 'orchestrator-phase',
      startedAt: Date.now(),
      previousMeetingId: opts.previousMeetingId ?? null,
    });

    return {
      meetingId,
      departments,
      agenda,
      topic,
    };
  }

  // ---- chain meeting -------------------------------------------------------

  /**
   * Create a new meeting chained from a previous meeting.
   *
   * Loads minutes from the previous meeting and includes them as context for
   * the new meeting topic. The new meeting's `previousMeetingId` is set for
   * traceability.
   *
   * Does NOT run the meeting (same as startMeeting).
   */
  chainMeeting(opts: {
    previousMeetingId: string;
    topic: string;
    agenda: string[];
    departments?: Department[];
  }): StartMeetingResult {
    const previousMeeting = getMeeting(opts.previousMeetingId);
    if (!previousMeeting) {
      throw new Error(`Previous meeting not found: ${opts.previousMeetingId}`);
    }

    const previousMinutes = getMinutesByMeeting(opts.previousMeetingId);
    if (!previousMinutes) {
      throw new Error(`No minutes found for previous meeting: ${opts.previousMeetingId}`);
    }

    // Prepend the previous meeting context to the topic
    const contextPrefix =
      `[Chained from meeting "${previousMeeting.topic}" (${opts.previousMeetingId})]\n\n` +
      `--- Previous Meeting Minutes ---\n${previousMinutes.content}\n--- End Previous Minutes ---\n\n`;

    const enrichedTopic = contextPrefix + opts.topic;

    logger.info(
      `Chaining meeting from "${previousMeeting.topic}" -> "${opts.topic}"`,
      { meetingId: opts.previousMeetingId },
    );

    return this.startMeeting({
      topic: enrichedTopic,
      agenda: opts.agenda,
      departments: opts.departments,
      previousMeetingId: opts.previousMeetingId,
    });
  }

  // ---- status -------------------------------------------------------------

  /**
   * Return a summary of all active meetings, pending @mentions, and the
   * current agent tree.
   */
  getStatus(): OrchestratorStatus {
    // Active meetings: anything not completed/cancelled/failed
    const allMeetings = listMeetings();
    const activeMeetings = allMeetings.filter(
      (m) => !['completed', 'cancelled', 'failed', 'reported', 'compacted'].includes(m.status),
    );

    // Pending @mentions across all meetings
    const pendingMentions = listPendingMentions();

    // Agent tree rooted at the orchestrator (may be null if no agents yet)
    const agentTree = getAgentTree(this.orchestratorId);

    return {
      activeMeetings,
      pendingMentions,
      agentTree,
    };
  }

  // ---- accessors ----------------------------------------------------------

  /** The leader pool used by this orchestrator instance. */
  getLeaderPool(): LeaderPool {
    return this.leaderPool;
  }

  /** The orchestrator's agent ID. */
  getId(): string {
    return this.orchestratorId;
  }
}
