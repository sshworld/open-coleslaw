import { getDb } from '../storage/db.js';

// ---------------------------------------------------------------------------
// Cost summary
// ---------------------------------------------------------------------------

export interface CostSummary {
  totalUsd: number;
  byMeeting: Record<string, number>;
  byDepartment: Record<string, number>;
  byTier: Record<string, number>;
  budgetLimit: number | null;
  budgetRemaining: number | null;
}

// ---------------------------------------------------------------------------
// In-memory cost entry
// ---------------------------------------------------------------------------

interface CostEntry {
  agentId: string;
  meetingId: string;
  costUsd: number;
  recordedAt: number;
}

// ---------------------------------------------------------------------------
// CostTracker
// ---------------------------------------------------------------------------

export class CostTracker {
  private budgetLimitUsd: number | null = null;
  private entries: CostEntry[] = [];

  /** Set a budget limit in USD. */
  setBudget(limitUsd: number): void {
    this.budgetLimitUsd = limitUsd;
  }

  /** Record a cost for an agent action. */
  recordCost(agentId: string, meetingId: string, costUsd: number): void {
    this.entries.push({
      agentId,
      meetingId,
      costUsd,
      recordedAt: Date.now(),
    });
  }

  /** Get the current cost summary, combining in-memory entries with DB data. */
  getSummary(meetingId?: string): CostSummary {
    const byMeeting: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    const byTier: Record<string, number> = {};
    let totalUsd = 0;

    // 1. Aggregate from the agents table in the DB
    try {
      const db = getDb();

      interface AgentCostRow {
        meeting_id: string | null;
        department: string;
        tier: string;
        cost_usd: number;
      }

      let agentRows: AgentCostRow[];
      if (meetingId) {
        agentRows = db
          .prepare('SELECT meeting_id, department, tier, cost_usd FROM agents WHERE meeting_id = ?')
          .all(meetingId) as AgentCostRow[];
      } else {
        agentRows = db
          .prepare('SELECT meeting_id, department, tier, cost_usd FROM agents')
          .all() as AgentCostRow[];
      }

      for (const row of agentRows) {
        const cost = row.cost_usd ?? 0;
        if (cost === 0) continue;

        totalUsd += cost;
        const mid = row.meeting_id ?? 'unknown';
        byMeeting[mid] = (byMeeting[mid] ?? 0) + cost;
        byDepartment[row.department] = (byDepartment[row.department] ?? 0) + cost;
        byTier[row.tier] = (byTier[row.tier] ?? 0) + cost;
      }

      // 2. Aggregate from the workers table
      interface WorkerCostRow {
        meeting_id: string;
        cost_usd: number;
        leader_id: string;
      }

      let workerRows: WorkerCostRow[];
      if (meetingId) {
        workerRows = db
          .prepare('SELECT meeting_id, cost_usd, leader_id FROM workers WHERE meeting_id = ?')
          .all(meetingId) as WorkerCostRow[];
      } else {
        workerRows = db
          .prepare('SELECT meeting_id, cost_usd, leader_id FROM workers')
          .all() as WorkerCostRow[];
      }

      for (const row of workerRows) {
        const cost = row.cost_usd ?? 0;
        if (cost === 0) continue;

        totalUsd += cost;
        byMeeting[row.meeting_id] = (byMeeting[row.meeting_id] ?? 0) + cost;
        byTier['worker'] = (byTier['worker'] ?? 0) + cost;

        // Look up the leader's department for the worker
        interface LeaderDeptRow { department: string }
        const leader = db
          .prepare('SELECT department FROM agents WHERE id = ?')
          .get(row.leader_id) as LeaderDeptRow | undefined;
        if (leader) {
          byDepartment[leader.department] = (byDepartment[leader.department] ?? 0) + cost;
        }
      }
    } catch {
      // DB might not be initialised yet; fall through to in-memory only
    }

    // 3. Aggregate in-memory entries
    const filteredEntries = meetingId
      ? this.entries.filter((e) => e.meetingId === meetingId)
      : this.entries;

    for (const entry of filteredEntries) {
      totalUsd += entry.costUsd;
      byMeeting[entry.meetingId] = (byMeeting[entry.meetingId] ?? 0) + entry.costUsd;
    }

    return {
      totalUsd,
      byMeeting,
      byDepartment,
      byTier,
      budgetLimit: this.budgetLimitUsd,
      budgetRemaining: this.budgetLimitUsd !== null ? this.budgetLimitUsd - totalUsd : null,
    };
  }

  /** Check if over budget. Returns a warning message or null. */
  checkBudget(): string | null {
    if (this.budgetLimitUsd === null) return null;

    const summary = this.getSummary();
    if (summary.totalUsd >= this.budgetLimitUsd) {
      return `Budget exceeded: $${summary.totalUsd.toFixed(4)} spent of $${this.budgetLimitUsd.toFixed(4)} limit`;
    }

    const remaining = this.budgetLimitUsd - summary.totalUsd;
    if (remaining < this.budgetLimitUsd * 0.1) {
      return `Budget warning: $${summary.totalUsd.toFixed(4)} spent, only $${remaining.toFixed(4)} remaining of $${this.budgetLimitUsd.toFixed(4)} limit`;
    }

    return null;
  }
}

/** Shared singleton instance. */
export const costTracker = new CostTracker();
