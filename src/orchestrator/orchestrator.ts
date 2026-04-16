import { v4 as uuidv4 } from 'uuid';
import type {
  Department,
  Meeting,
  MentionRecord,
  AgentNode,
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
import { MeetingRunner } from './meeting-runner.js';
import { eventBus } from './event-bus.js';
import { logger } from '../utils/logger.js';
import { analyzeProject, formatProjectContext } from '../agents/project-analyzer.js';

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
// StartMeeting options
// ---------------------------------------------------------------------------

export interface StartMeetingOptions {
  topic: string;
  agenda: string[];
  departments?: Department[];
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
// Orchestrator
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
   * Start a new meeting.
   *
   * 1. Selects departments (if not provided).
   * 2. Creates the meeting record in SQLite.
   * 3. Spawns leaders via the LeaderPool.
   * 4. Runs the MeetingRunner lifecycle (opening -> discussion -> synthesis -> minutes).
   * 5. Deactivates leaders after completion.
   *
   * Returns the meeting ID.
   */
  async startMeeting(opts: StartMeetingOptions & { previousMeetingId?: string | null }): Promise<string> {
    const { topic, agenda } = opts;
    const departments = opts.departments ?? this.selectLeaders(topic, agenda);

    logger.info(`Starting meeting: "${topic}" with departments: [${departments.join(', ')}]`);

    // 0. Analyse the current working directory for project context
    let projectContext: string | undefined;
    try {
      const analysis = await analyzeProject(process.cwd());
      projectContext = formatProjectContext(analysis);
      logger.debug('Project analysis complete', { meetingId: topic });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Project analysis failed (proceeding without context): ${msg}`);
    }

    // 1. Create the meeting record
    const meetingId = uuidv4();
    const meeting = createMeeting({
      id: meetingId,
      topic,
      agenda,
      participantIds: [], // Will be filled in after leader spawning
      initiatedBy: this.orchestratorId,
      status: 'convening',
      phase: 'convening',
      startedAt: Date.now(),
      previousMeetingId: opts.previousMeetingId ?? null,
    });

    // 2. Spawn leaders
    const leaders: AgentNode[] = [];
    for (const dept of departments) {
      const leader = this.leaderPool.spawnLeader(dept, meetingId);
      leaders.push(leader);
    }

    // Update meeting with participant IDs
    updateMeeting(meetingId, {
      participantIds: leaders.map((l) => l.id),
    });

    // 3. Run the meeting (with project context for leader prompts)
    const runner = new MeetingRunner(meetingId, leaders, projectContext);

    try {
      await runner.run();
    } finally {
      // 4. Deactivate leaders regardless of success/failure
      for (const leader of leaders) {
        this.leaderPool.deactivateLeader(leader.id);
      }
    }

    return meetingId;
  }

  // ---- chain meeting -------------------------------------------------------

  /**
   * Chain a new meeting from the output of a previous meeting.
   *
   * Loads minutes from the previous meeting and includes them as context for
   * the new meeting topic. The new meeting's `previousMeetingId` is set for
   * traceability.
   */
  async chainMeeting(opts: {
    previousMeetingId: string;
    topic: string;
    agenda: string[];
    departments?: Department[];
  }): Promise<string> {
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
