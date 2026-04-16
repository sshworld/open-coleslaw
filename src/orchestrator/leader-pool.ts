import { v4 as uuidv4 } from 'uuid';
import type { AgentNode, Department } from '../types/index.js';
import { createAgent, updateAgent, listAgentsByMeeting } from '../storage/index.js';
import { getDepartment } from '../agents/departments.js';
import { eventBus } from './event-bus.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// LeaderPool — manages leader agent lifecycles
// ---------------------------------------------------------------------------

export class LeaderPool {
  /**
   * Active leaders keyed by their agent ID.
   * This is a fast in-memory index; the source of truth is SQLite.
   */
  private readonly activeLeaders = new Map<string, AgentNode>();

  // ---- spawn --------------------------------------------------------------

  /**
   * Spawn a new leader agent for the given department and meeting.
   *
   * Persists the agent to SQLite and emits an `agent_spawned` event on the
   * event bus.
   */
  spawnLeader(department: Department, meetingId: string): AgentNode {
    const deptInfo = getDepartment(department);

    const agent = createAgent({
      tier: 'leader',
      role: deptInfo.leaderRole,
      department,
      parentId: null, // The orchestrator is implicit; no stored orchestrator agent row yet.
      meetingId,
      status: 'in-meeting',
      currentTask: null,
      sessionId: null,
    });

    this.activeLeaders.set(agent.id, agent);

    logger.info(`Spawned leader: ${deptInfo.leaderRole}`, {
      agentId: agent.id,
      department,
      meetingId,
    });

    eventBus.emitAgentEvent({
      kind: 'agent_spawned',
      agentId: agent.id,
      agentType: 'leader',
      parentId: null,
      label: deptInfo.leaderRole,
      department,
    });

    return agent;
  }

  // ---- query --------------------------------------------------------------

  /**
   * Return all currently-active leaders assigned to a given meeting.
   *
   * Falls back to a SQLite query filtered by status so that leaders which were
   * deactivated out-of-band are excluded.
   */
  getLeadersForMeeting(meetingId: string): AgentNode[] {
    // Fast path: filter in-memory cache
    const fromCache = [...this.activeLeaders.values()].filter(
      (a) => a.meetingId === meetingId,
    );

    if (fromCache.length > 0) {
      return fromCache;
    }

    // Slow path: query storage (e.g. after a server restart)
    return listAgentsByMeeting(meetingId).filter(
      (a) => a.tier === 'leader' && a.status !== 'completed' && a.status !== 'failed',
    );
  }

  // ---- deactivate ---------------------------------------------------------

  /**
   * Mark a leader as completed and remove it from the in-memory cache.
   */
  deactivateLeader(leaderId: string): void {
    const leader = this.activeLeaders.get(leaderId);

    updateAgent(leaderId, {
      status: 'completed',
      completedAt: Date.now(),
    });

    this.activeLeaders.delete(leaderId);

    logger.info(`Deactivated leader: ${leaderId}`, {
      agentId: leaderId,
      department: leader?.department,
    });

    eventBus.emitAgentEvent({
      kind: 'agent_destroyed',
      agentId: leaderId,
    });
  }
}
