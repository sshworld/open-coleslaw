import type { AgentNode, Department } from '../types/index.js';
import { createAgent, updateAgent, listAgentsByMeeting } from '../storage/index.js';
import { getDepartment } from '../agents/departments.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// LeaderPool — manages leader agent lifecycles (storage only)
//
// The old subprocess-based architecture is gone; agent dispatch is now handled
// by Claude Code's Agent tool via skill/agent markdown. The LeaderPool here is
// a thin wrapper around the agents table used for book-keeping (cost, history).
// It no longer emits dashboard events — the dashboard now tracks meetings,
// not an agent graph.
// ---------------------------------------------------------------------------

export class LeaderPool {
  private readonly activeLeaders = new Map<string, AgentNode>();

  spawnLeader(department: Department, meetingId: string): AgentNode {
    const deptInfo = getDepartment(department);

    const agent = createAgent({
      tier: 'leader',
      role: deptInfo.leaderRole,
      department,
      parentId: null,
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

    return agent;
  }

  getLeadersForMeeting(meetingId: string): AgentNode[] {
    const fromCache = [...this.activeLeaders.values()].filter(
      (a) => a.meetingId === meetingId,
    );
    if (fromCache.length > 0) return fromCache;

    return listAgentsByMeeting(meetingId).filter(
      (a) => a.tier === 'leader' && a.status !== 'completed' && a.status !== 'failed',
    );
  }

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
  }
}
