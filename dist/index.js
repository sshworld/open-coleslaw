#!/usr/bin/env node
import {
  getDb
} from "./chunk-GFILTXTU.js";

// src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// src/tools/start-meeting.ts
import { z } from "zod";

// src/orchestrator/orchestrator.ts
import { v4 as uuidv46 } from "uuid";

// src/storage/agent-store.ts
import { v4 as uuidv4 } from "uuid";
function rowToAgent(row) {
  return {
    id: row.id,
    tier: row.tier,
    role: row.role,
    department: row.department,
    parentId: row.parent_id,
    meetingId: row.meeting_id,
    status: row.status,
    currentTask: row.current_task,
    sessionId: row.session_id,
    spawnedAt: row.spawned_at,
    completedAt: row.completed_at,
    costUsd: row.cost_usd
  };
}
function createAgent(agent) {
  const db = getDb();
  const id = agent.id ?? uuidv4();
  const spawnedAt = agent.spawnedAt ?? Date.now();
  const completedAt = agent.completedAt ?? null;
  const costUsd = agent.costUsd ?? 0;
  db.prepare(
    `INSERT INTO agents (id, tier, role, department, parent_id, meeting_id, status, current_task, session_id, spawned_at, completed_at, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    agent.tier,
    agent.role,
    agent.department,
    agent.parentId,
    agent.meetingId,
    agent.status,
    agent.currentTask,
    agent.sessionId,
    spawnedAt,
    completedAt,
    costUsd
  );
  return {
    id,
    tier: agent.tier,
    role: agent.role,
    department: agent.department,
    parentId: agent.parentId,
    meetingId: agent.meetingId,
    status: agent.status,
    currentTask: agent.currentTask,
    sessionId: agent.sessionId,
    spawnedAt,
    completedAt,
    costUsd
  };
}
function getAgent(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
  return row ? rowToAgent(row) : null;
}
function updateAgent(id, updates) {
  const db = getDb();
  const existing = getAgent(id);
  if (!existing) return null;
  const fields = [];
  const values = [];
  if (updates.tier !== void 0) {
    fields.push("tier = ?");
    values.push(updates.tier);
  }
  if (updates.role !== void 0) {
    fields.push("role = ?");
    values.push(updates.role);
  }
  if (updates.department !== void 0) {
    fields.push("department = ?");
    values.push(updates.department);
  }
  if (updates.parentId !== void 0) {
    fields.push("parent_id = ?");
    values.push(updates.parentId);
  }
  if (updates.meetingId !== void 0) {
    fields.push("meeting_id = ?");
    values.push(updates.meetingId);
  }
  if (updates.status !== void 0) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.currentTask !== void 0) {
    fields.push("current_task = ?");
    values.push(updates.currentTask);
  }
  if (updates.sessionId !== void 0) {
    fields.push("session_id = ?");
    values.push(updates.sessionId);
  }
  if (updates.spawnedAt !== void 0) {
    fields.push("spawned_at = ?");
    values.push(updates.spawnedAt);
  }
  if (updates.completedAt !== void 0) {
    fields.push("completed_at = ?");
    values.push(updates.completedAt);
  }
  if (updates.costUsd !== void 0) {
    fields.push("cost_usd = ?");
    values.push(updates.costUsd);
  }
  if (fields.length === 0) return existing;
  values.push(id);
  db.prepare(`UPDATE agents SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getAgent(id);
}
function listAgentsByMeeting(meetingId) {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM agents WHERE meeting_id = ?").all(meetingId);
  return rows.map(rowToAgent);
}
function listAgentsByParent(parentId) {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM agents WHERE parent_id = ?").all(parentId);
  return rows.map(rowToAgent);
}
function getAgentTree(rootId) {
  const agent = getAgent(rootId);
  if (!agent) return null;
  const children = listAgentsByParent(rootId);
  const treeNode = {
    ...agent,
    children: children.map((child) => getAgentTree(child.id)).filter((node) => node !== null)
  };
  return treeNode;
}

// src/storage/meeting-store.ts
import { v4 as uuidv42 } from "uuid";
function ensurePreviousMeetingIdColumn() {
  const db = getDb();
  const cols = db.prepare("PRAGMA table_info('meetings')").all();
  const hasColumn = cols.some((c) => c.name === "previous_meeting_id");
  if (!hasColumn) {
    db.exec("ALTER TABLE meetings ADD COLUMN previous_meeting_id TEXT DEFAULT NULL");
  }
}
var columnChecked = false;
function rowToMeeting(row) {
  return {
    id: row.id,
    topic: row.topic,
    agenda: JSON.parse(row.agenda),
    participantIds: JSON.parse(row.participant_ids),
    status: row.status,
    phase: row.phase,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    initiatedBy: row.initiated_by,
    previousMeetingId: row.previous_meeting_id ?? null
  };
}
function createMeeting(meeting) {
  if (!columnChecked) {
    ensurePreviousMeetingIdColumn();
    columnChecked = true;
  }
  const db = getDb();
  const id = meeting.id ?? uuidv42();
  const status = meeting.status ?? "pending";
  const phase = meeting.phase ?? "orchestrator-phase";
  const startedAt = meeting.startedAt ?? null;
  const completedAt = meeting.completedAt ?? null;
  const previousMeetingId = meeting.previousMeetingId ?? null;
  db.prepare(
    `INSERT INTO meetings (id, topic, agenda, participant_ids, status, phase, started_at, completed_at, initiated_by, previous_meeting_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    meeting.topic,
    JSON.stringify(meeting.agenda),
    JSON.stringify(meeting.participantIds),
    status,
    phase,
    startedAt,
    completedAt,
    meeting.initiatedBy,
    previousMeetingId
  );
  return {
    id,
    topic: meeting.topic,
    agenda: meeting.agenda,
    participantIds: meeting.participantIds,
    status,
    phase,
    startedAt,
    completedAt,
    initiatedBy: meeting.initiatedBy,
    previousMeetingId
  };
}
function getMeeting(id) {
  if (!columnChecked) {
    ensurePreviousMeetingIdColumn();
    columnChecked = true;
  }
  const db = getDb();
  const row = db.prepare("SELECT * FROM meetings WHERE id = ?").get(id);
  return row ? rowToMeeting(row) : null;
}
function updateMeeting(id, updates) {
  const db = getDb();
  const existing = getMeeting(id);
  if (!existing) return null;
  const fields = [];
  const values = [];
  if (updates.topic !== void 0) {
    fields.push("topic = ?");
    values.push(updates.topic);
  }
  if (updates.agenda !== void 0) {
    fields.push("agenda = ?");
    values.push(JSON.stringify(updates.agenda));
  }
  if (updates.participantIds !== void 0) {
    fields.push("participant_ids = ?");
    values.push(JSON.stringify(updates.participantIds));
  }
  if (updates.status !== void 0) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.phase !== void 0) {
    fields.push("phase = ?");
    values.push(updates.phase);
  }
  if (updates.startedAt !== void 0) {
    fields.push("started_at = ?");
    values.push(updates.startedAt);
  }
  if (updates.completedAt !== void 0) {
    fields.push("completed_at = ?");
    values.push(updates.completedAt);
  }
  if (updates.initiatedBy !== void 0) {
    fields.push("initiated_by = ?");
    values.push(updates.initiatedBy);
  }
  if (updates.previousMeetingId !== void 0) {
    fields.push("previous_meeting_id = ?");
    values.push(updates.previousMeetingId);
  }
  if (fields.length === 0) return existing;
  values.push(id);
  db.prepare(`UPDATE meetings SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getMeeting(id);
}
function listMeetings(statusFilter) {
  if (!columnChecked) {
    ensurePreviousMeetingIdColumn();
    columnChecked = true;
  }
  const db = getDb();
  let rows;
  if (statusFilter) {
    rows = db.prepare("SELECT * FROM meetings WHERE status = ? ORDER BY started_at DESC").all(statusFilter);
  } else {
    rows = db.prepare("SELECT * FROM meetings ORDER BY started_at DESC").all();
  }
  return rows.map(rowToMeeting);
}

// src/storage/worker-store.ts
import { v4 as uuidv43 } from "uuid";
function rowToWorker(row) {
  return {
    id: row.id,
    leaderId: row.leader_id,
    meetingId: row.meeting_id,
    taskDescription: row.task_description,
    taskType: row.task_type,
    status: row.status,
    inputContext: row.input_context,
    outputResult: row.output_result,
    errorMessage: row.error_message,
    dependencies: JSON.parse(row.dependencies),
    spawnedAt: row.spawned_at,
    completedAt: row.completed_at,
    costUsd: row.cost_usd
  };
}
function createWorker(worker) {
  const db = getDb();
  const id = worker.id ?? uuidv43();
  const status = worker.status ?? "pending";
  const spawnedAt = worker.spawnedAt ?? Date.now();
  const completedAt = worker.completedAt ?? null;
  const costUsd = worker.costUsd ?? 0;
  db.prepare(
    `INSERT INTO workers (id, leader_id, meeting_id, task_description, task_type, status, input_context, output_result, error_message, dependencies, spawned_at, completed_at, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    worker.leaderId,
    worker.meetingId,
    worker.taskDescription,
    worker.taskType,
    status,
    worker.inputContext,
    worker.outputResult,
    worker.errorMessage,
    JSON.stringify(worker.dependencies),
    spawnedAt,
    completedAt,
    costUsd
  );
  return {
    id,
    leaderId: worker.leaderId,
    meetingId: worker.meetingId,
    taskDescription: worker.taskDescription,
    taskType: worker.taskType,
    status,
    inputContext: worker.inputContext,
    outputResult: worker.outputResult,
    errorMessage: worker.errorMessage,
    dependencies: worker.dependencies,
    spawnedAt,
    completedAt,
    costUsd
  };
}
function getWorker(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM workers WHERE id = ?").get(id);
  return row ? rowToWorker(row) : null;
}
function updateWorker(id, updates) {
  const db = getDb();
  const existing = getWorker(id);
  if (!existing) return null;
  const fields = [];
  const values = [];
  if (updates.leaderId !== void 0) {
    fields.push("leader_id = ?");
    values.push(updates.leaderId);
  }
  if (updates.meetingId !== void 0) {
    fields.push("meeting_id = ?");
    values.push(updates.meetingId);
  }
  if (updates.taskDescription !== void 0) {
    fields.push("task_description = ?");
    values.push(updates.taskDescription);
  }
  if (updates.taskType !== void 0) {
    fields.push("task_type = ?");
    values.push(updates.taskType);
  }
  if (updates.status !== void 0) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.inputContext !== void 0) {
    fields.push("input_context = ?");
    values.push(updates.inputContext);
  }
  if (updates.outputResult !== void 0) {
    fields.push("output_result = ?");
    values.push(updates.outputResult);
  }
  if (updates.errorMessage !== void 0) {
    fields.push("error_message = ?");
    values.push(updates.errorMessage);
  }
  if (updates.dependencies !== void 0) {
    fields.push("dependencies = ?");
    values.push(JSON.stringify(updates.dependencies));
  }
  if (updates.spawnedAt !== void 0) {
    fields.push("spawned_at = ?");
    values.push(updates.spawnedAt);
  }
  if (updates.completedAt !== void 0) {
    fields.push("completed_at = ?");
    values.push(updates.completedAt);
  }
  if (updates.costUsd !== void 0) {
    fields.push("cost_usd = ?");
    values.push(updates.costUsd);
  }
  if (fields.length === 0) return existing;
  values.push(id);
  db.prepare(`UPDATE workers SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getWorker(id);
}
function listWorkersByLeader(leaderId) {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM workers WHERE leader_id = ? ORDER BY spawned_at ASC").all(leaderId);
  return rows.map(rowToWorker);
}

// src/storage/mention-store.ts
import { v4 as uuidv44 } from "uuid";
function rowToMention(row) {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    agendaItem: row.agenda_item,
    summary: row.summary,
    options: JSON.parse(row.options),
    urgency: row.urgency,
    status: row.status,
    userDecision: row.user_decision,
    userReasoning: row.user_reasoning,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at
  };
}
function getMention(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM mentions WHERE id = ?").get(id);
  return row ? rowToMention(row) : null;
}
function updateMention(id, updates) {
  const db = getDb();
  const existing = getMention(id);
  if (!existing) return null;
  const fields = [];
  const values = [];
  if (updates.meetingId !== void 0) {
    fields.push("meeting_id = ?");
    values.push(updates.meetingId);
  }
  if (updates.agendaItem !== void 0) {
    fields.push("agenda_item = ?");
    values.push(updates.agendaItem);
  }
  if (updates.summary !== void 0) {
    fields.push("summary = ?");
    values.push(updates.summary);
  }
  if (updates.options !== void 0) {
    fields.push("options = ?");
    values.push(JSON.stringify(updates.options));
  }
  if (updates.urgency !== void 0) {
    fields.push("urgency = ?");
    values.push(updates.urgency);
  }
  if (updates.status !== void 0) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.userDecision !== void 0) {
    fields.push("user_decision = ?");
    values.push(updates.userDecision);
  }
  if (updates.userReasoning !== void 0) {
    fields.push("user_reasoning = ?");
    values.push(updates.userReasoning);
  }
  if (updates.createdAt !== void 0) {
    fields.push("created_at = ?");
    values.push(updates.createdAt);
  }
  if (updates.resolvedAt !== void 0) {
    fields.push("resolved_at = ?");
    values.push(updates.resolvedAt);
  }
  if (fields.length === 0) return existing;
  values.push(id);
  db.prepare(`UPDATE mentions SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getMention(id);
}
function listPendingMentions() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM mentions WHERE status = 'pending' ORDER BY created_at ASC").all();
  return rows.map(rowToMention);
}
function listMentionsByMeeting(meetingId) {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM mentions WHERE meeting_id = ? ORDER BY created_at ASC").all(meetingId);
  return rows.map(rowToMention);
}

// src/storage/minutes-store.ts
import { v4 as uuidv45 } from "uuid";
function rowToMinutes(row) {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    format: row.format,
    content: row.content,
    actionItems: JSON.parse(row.action_items),
    createdAt: row.created_at
  };
}
function createMinutes(minutes) {
  const db = getDb();
  const id = minutes.id ?? uuidv45();
  const createdAt = minutes.createdAt ?? Date.now();
  db.prepare(
    `INSERT INTO minutes (id, meeting_id, format, content, action_items, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    minutes.meetingId,
    minutes.format,
    minutes.content,
    JSON.stringify(minutes.actionItems),
    createdAt
  );
  return {
    id,
    meetingId: minutes.meetingId,
    format: minutes.format,
    content: minutes.content,
    actionItems: minutes.actionItems,
    createdAt
  };
}
function getMinutesByMeeting(meetingId) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM minutes WHERE meeting_id = ?").get(meetingId);
  return row ? rowToMinutes(row) : null;
}

// src/storage/task-store.ts
function getTasksFromMinutes(meetingId) {
  const db = getDb();
  const row = db.prepare("SELECT action_items FROM minutes WHERE meeting_id = ?").get(meetingId);
  if (!row) return [];
  return JSON.parse(row.action_items);
}

// src/types/agent.ts
var TIER_CONFIGS = {
  orchestrator: {
    model: "claude-opus-4-6",
    maxTurns: 10
  },
  leader: {
    model: "claude-sonnet-4-6",
    maxTurns: 20
  },
  worker: {
    model: "claude-sonnet-4-6",
    maxTurns: 30
  }
};
var DEPARTMENT_TOOLS = {
  architecture: ["Read", "Grep", "Glob"],
  engineering: ["Read", "Grep", "Glob", "Write", "Edit", "Bash"],
  qa: ["Read", "Grep", "Glob", "Bash"],
  product: ["Read"],
  research: ["Read", "Grep", "Glob", "WebSearch"]
};

// src/types/meeting.ts
var DEFAULT_MEETING_CONFIG = {
  maxRoundsPerItem: 3,
  convergenceThreshold: 0.8,
  model: "claude-sonnet-4-6"
};

// src/agents/departments.ts
var DEPARTMENT_REGISTRY = /* @__PURE__ */ new Map([
  [
    "architecture",
    {
      name: "architecture",
      description: "Responsible for system design, schema definitions, API surface design, and dependency analysis. The architecture department plans before code is written \u2014 it produces blueprints, not implementations.",
      leaderRole: "arch-leader",
      workerTypes: ["schema-designer", "api-designer", "dependency-analyzer"],
      allowedTools: DEPARTMENT_TOOLS.architecture
    }
  ],
  [
    "engineering",
    {
      name: "engineering",
      description: "Responsible for writing, modifying, and refactoring production code. Engineering owns feature development, bug fixes, and code quality improvements.",
      leaderRole: "eng-leader",
      workerTypes: ["feature-dev", "bug-fixer", "refactorer"],
      allowedTools: DEPARTMENT_TOOLS.engineering
    }
  ],
  [
    "qa",
    {
      name: "qa",
      description: "Responsible for test creation, test execution, security auditing, and performance testing. QA ensures deliverables meet acceptance criteria and do not introduce regressions.",
      leaderRole: "qa-leader",
      workerTypes: ["test-writer", "test-runner", "security-auditor", "perf-tester"],
      allowedTools: DEPARTMENT_TOOLS.qa
    }
  ],
  [
    "product",
    {
      name: "product",
      description: "Responsible for requirements analysis, user-flow mapping, and stakeholder alignment. Product translates user intent into well-scoped, actionable requirements for other departments.",
      leaderRole: "pm-leader",
      workerTypes: ["requirements-analyzer", "user-flow-mapper"],
      allowedTools: DEPARTMENT_TOOLS.product
    }
  ],
  [
    "research",
    {
      name: "research",
      description: "Responsible for codebase exploration, documentation search, benchmarking, and knowledge gathering. Research produces facts and context that inform decisions made by other departments.",
      leaderRole: "research-leader",
      workerTypes: ["code-explorer", "doc-searcher", "benchmark-runner"],
      allowedTools: DEPARTMENT_TOOLS.research
    }
  ]
]);
var ROLE_TO_DEPARTMENT = new Map(
  [...DEPARTMENT_REGISTRY.values()].map((d) => [d.leaderRole, d.name])
);
function getDepartment(dept) {
  const info = DEPARTMENT_REGISTRY.get(dept);
  if (!info) {
    throw new Error(`Unknown department: ${dept}`);
  }
  return info;
}

// src/orchestrator/event-bus.ts
import { EventEmitter } from "events";
var EventBus = class {
  emitter = new EventEmitter();
  constructor() {
    this.emitter.setMaxListeners(50);
  }
  // ---- emit ---------------------------------------------------------------
  /**
   * Emit a single agent lifecycle event.
   *
   * The event is:
   * 1. Broadcast to all `agent_event` listeners.
   * 2. Wrapped in a `delta` dashboard event and broadcast to `dashboard` listeners.
   * 3. (Planned) Persisted to SQLite via the storage layer.
   */
  emitAgentEvent(event) {
    this.emitter.emit("agent_event", event);
    const delta = {
      type: "delta",
      timestamp: Date.now(),
      events: [event]
    };
    this.emitter.emit("dashboard", delta);
  }
  /**
   * Emit a full dashboard snapshot (used on initial WebSocket connection).
   */
  emitDashboardSnapshot(snapshot) {
    this.emitter.emit("dashboard", snapshot);
  }
  // ---- subscribe ----------------------------------------------------------
  on(event, listener) {
    this.emitter.on(event, listener);
  }
  off(event, listener) {
    this.emitter.off(event, listener);
  }
  once(event, listener) {
    this.emitter.once(event, listener);
  }
  // ---- utility ------------------------------------------------------------
  removeAllListeners(event) {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }
  listenerCount(event) {
    return this.emitter.listenerCount(event);
  }
};
var eventBus = new EventBus();

// src/utils/logger.ts
var LEVEL_PRIORITY = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
var Logger = class {
  minLevel = "info";
  /**
   * Set the minimum log level. Messages below this level are silently dropped.
   * Defaults to 'info'. Set to 'debug' for verbose output.
   */
  setLevel(level) {
    this.minLevel = level;
  }
  getLevel() {
    return this.minLevel;
  }
  debug(message, context) {
    this.log("debug", message, context);
  }
  info(message, context) {
    this.log("info", message, context);
  }
  warn(message, context) {
    this.log("warn", message, context);
  }
  error(message, context) {
    this.log("error", message, context);
  }
  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------
  log(level, message, context) {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) {
      return;
    }
    const entry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level,
      message
    };
    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }
    process.stderr.write(JSON.stringify(entry) + "\n");
  }
};
var logger = new Logger();

// src/orchestrator/leader-pool.ts
var LeaderPool = class {
  /**
   * Active leaders keyed by their agent ID.
   * This is a fast in-memory index; the source of truth is SQLite.
   */
  activeLeaders = /* @__PURE__ */ new Map();
  // ---- spawn --------------------------------------------------------------
  /**
   * Spawn a new leader agent for the given department and meeting.
   *
   * Persists the agent to SQLite and emits an `agent_spawned` event on the
   * event bus.
   */
  spawnLeader(department, meetingId) {
    const deptInfo = getDepartment(department);
    const agent = createAgent({
      tier: "leader",
      role: deptInfo.leaderRole,
      department,
      parentId: null,
      // The orchestrator is implicit; no stored orchestrator agent row yet.
      meetingId,
      status: "in-meeting",
      currentTask: null,
      sessionId: null
    });
    this.activeLeaders.set(agent.id, agent);
    logger.info(`Spawned leader: ${deptInfo.leaderRole}`, {
      agentId: agent.id,
      department,
      meetingId
    });
    eventBus.emitAgentEvent({
      kind: "agent_spawned",
      agentId: agent.id,
      agentType: "leader",
      parentId: null,
      label: deptInfo.leaderRole,
      department
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
  getLeadersForMeeting(meetingId) {
    const fromCache = [...this.activeLeaders.values()].filter(
      (a) => a.meetingId === meetingId
    );
    if (fromCache.length > 0) {
      return fromCache;
    }
    return listAgentsByMeeting(meetingId).filter(
      (a) => a.tier === "leader" && a.status !== "completed" && a.status !== "failed"
    );
  }
  // ---- deactivate ---------------------------------------------------------
  /**
   * Mark a leader as completed and remove it from the in-memory cache.
   */
  deactivateLeader(leaderId) {
    const leader = this.activeLeaders.get(leaderId);
    updateAgent(leaderId, {
      status: "completed",
      completedAt: Date.now()
    });
    this.activeLeaders.delete(leaderId);
    logger.info(`Deactivated leader: ${leaderId}`, {
      agentId: leaderId,
      department: leader?.department
    });
    eventBus.emitAgentEvent({
      kind: "agent_destroyed",
      agentId: leaderId
    });
  }
};

// src/agents/leader-prompts.ts
function rulesBlock(extraRules) {
  const base = [
    "Never modify files outside the project root unless explicitly told to.",
    "Never commit, push, or deploy without a confirmed user decision.",
    "If you encounter ambiguity that could lead to significant rework, emit @USER_DECISION_NEEDED immediately rather than guessing.",
    "Keep responses concise. Prefer structured output (lists, tables) over prose.",
    "When delegating to workers, provide clear task descriptions with explicit acceptance criteria.",
    "Respect the tool allowlist for your department \u2014 do not attempt to use tools you have not been granted.",
    "Report cost and token usage whenever you complete a significant sub-task."
  ];
  const rules = extraRules ? [...base, ...extraRules] : base;
  return rules.map((r, i) => `${i + 1}. ${r}`).join("\n");
}
function meetingProtocol() {
  return `## MEETING PROTOCOL

When participating in a meeting you MUST follow these rules:

1. **Opening phase** \u2014 Listen to the agenda presented by the orchestrator. Acknowledge understanding. Surface any concerns or dependencies your department has regarding the agenda items.

2. **Discussion phase** \u2014 Contribute your department's perspective on each agenda item. Be specific: reference files, modules, or prior decisions. If you disagree with another leader, state your reasoning clearly and propose an alternative.

3. **When to emit @USER_DECISION_NEEDED** \u2014 Emit this tag ONLY when:
   - Two or more leaders have irreconcilable positions after a full discussion round.
   - A decision has significant cost, security, or architectural implications that exceed the meeting's delegated authority.
   - The user explicitly asked to be looped in on a particular topic.
   Include: a concise summary of the options, who supports each option, and your recommended default.

4. **Synthesis phase** \u2014 Confirm or amend the proposed action items. Ensure your department's commitments are accurate and achievable.

5. **Post-meeting** \u2014 Execute your assigned action items by spawning workers or performing lightweight tasks directly.`;
}
function workforceManagement(deptDescription, workerTypes) {
  return `## WORKFORCE MANAGEMENT

You lead the department: ${deptDescription}

Available worker types you can spawn: ${workerTypes.join(", ")}

### When to spawn workers
- Spawn workers for tasks that require focused execution (file changes, test runs, research).
- Do NOT spawn workers for simple questions you can answer from context.
- Prefer spawning multiple independent workers in parallel over sequential single-worker chains.

### How to spawn workers
When you decide a worker is needed, output a structured worker-spawn request:
\`\`\`
SPAWN_WORKER:
  type: <worker-type>
  task: <one-line description>
  context: <relevant files, decisions, or constraints>
  acceptance_criteria:
    - <criterion 1>
    - <criterion 2>
\`\`\`

### Aggregating results
When workers complete, review their output:
- If a worker succeeded \u2014 incorporate the result and move forward.
- If a worker failed \u2014 diagnose the failure. Retry with adjusted instructions or escalate in the meeting.
- Summarise aggregated results before reporting back to the meeting.`;
}
var IDENTITIES = {
  "arch-leader": `## IDENTITY

You are the **Architecture Leader**. You own system design decisions for this project.

Your responsibilities:
- Evaluate and propose system architecture (module boundaries, data flow, APIs).
- Design database schemas and data models.
- Analyse dependency graphs and flag coupling or circular-dependency risks.
- Ensure new features fit the existing architecture; propose refactors when they do not.
- Produce architecture decision records (ADRs) when significant choices are made.

You are a planner, not an implementer. You produce blueprints and hand implementation to Engineering.`,
  "eng-leader": `## IDENTITY

You are the **Engineering Leader**. You own code quality and delivery for this project.

Your responsibilities:
- Break down approved designs into implementable tasks.
- Assign coding work to feature-dev, bug-fixer, and refactorer workers.
- Review worker output for correctness, style, and adherence to project conventions.
- Coordinate with QA to ensure changes are testable.
- Flag technical debt and propose refactoring when it reaches a threshold.

You write and ship code through your workers. You translate architecture into working software.`,
  "qa-leader": `## IDENTITY

You are the **QA Leader**. You own quality assurance, testing strategy, and security posture.

Your responsibilities:
- Define test plans: unit tests, integration tests, and end-to-end flows.
- Spawn test-writer workers to create tests for new or changed code.
- Spawn test-runner workers to execute test suites and report results.
- Spawn security-auditor workers when new dependencies or sensitive code paths are introduced.
- Spawn perf-tester workers for performance-critical changes.
- Block merges that lack adequate test coverage or have failing tests.

You are the project's quality gate. Nothing ships without your sign-off.`,
  "pm-leader": `## IDENTITY

You are the **Product Leader**. You own requirements clarity and user-facing coherence.

Your responsibilities:
- Analyse user requests and translate them into structured requirements.
- Map user flows to ensure feature completeness and good UX.
- Prioritise work items when resources are limited.
- Ensure the team is building what the user actually asked for, not what was assumed.
- Write acceptance criteria that other departments can verify against.

You are the voice of the user inside the team. You bridge intent and implementation.`,
  "research-leader": `## IDENTITY

You are the **Research Leader**. You own information gathering and knowledge synthesis.

Your responsibilities:
- Explore the existing codebase to answer questions from other departments.
- Search documentation, READMEs, and external resources for relevant context.
- Run benchmarks when quantitative data is needed for a decision.
- Summarise findings in a structured, citable format.
- Maintain a knowledge base of discovered facts about the project.

You provide the evidence base. Other departments make decisions; you supply the facts.`
};
function getLeaderSystemPrompt(department, rules, projectContext) {
  const dept = getDepartment(department);
  const identity = IDENTITIES[dept.leaderRole];
  if (!identity) {
    throw new Error(`No identity prompt defined for leader role: ${dept.leaderRole}`);
  }
  const sections = [
    identity,
    meetingProtocol(),
    workforceManagement(dept.description, dept.workerTypes),
    `## RULES

${rulesBlock(rules)}`
  ];
  if (projectContext) {
    sections.push(projectContext);
  }
  return sections.join("\n\n");
}

// src/agents/tiers.ts
function getTierConfig(tier) {
  const config = TIER_CONFIGS[tier];
  if (!config) {
    throw new Error(`Unknown agent tier: ${tier}`);
  }
  return { ...config };
}

// src/agents/worker-prompts.ts
var WORKER_DESCRIPTIONS = {
  // Architecture workers
  "schema-designer": "You design database schemas and data models. Output CREATE TABLE statements, type definitions, or ERD descriptions.",
  "api-designer": "You design API surfaces \u2014 REST endpoints, RPC methods, or function signatures. Output OpenAPI snippets or typed interface definitions.",
  "dependency-analyzer": "You analyse project dependencies and module coupling. Output dependency graphs, circular-dependency reports, or upgrade recommendations.",
  // Engineering workers
  "feature-dev": "You implement new features by writing production code. Follow the project conventions. Output complete, working code changes.",
  "bug-fixer": "You diagnose and fix bugs. Read the relevant code, identify the root cause, and produce a minimal correct fix.",
  "refactorer": "You improve existing code without changing its behaviour. Focus on readability, performance, or reducing duplication.",
  // QA workers
  "test-writer": "You write test cases \u2014 unit, integration, or end-to-end. Ensure each test has a clear assertion and covers the acceptance criteria.",
  "test-runner": "You execute test suites and report results. Run commands, capture output, and summarise pass/fail counts and failures.",
  "security-auditor": "You audit code for security vulnerabilities \u2014 injection, auth issues, insecure dependencies, exposed secrets. Output a structured finding list.",
  "perf-tester": "You run performance tests and benchmarks. Measure response time, throughput, or resource usage and report quantitative results.",
  // Product workers
  "requirements-analyzer": "You analyse user requests and existing documentation to produce structured requirements with acceptance criteria.",
  "user-flow-mapper": "You trace user-facing flows through the system \u2014 from input to output \u2014 and document each step, decision point, and edge case.",
  // Research workers
  "code-explorer": "You explore the codebase to answer specific questions. Read files, trace call chains, and summarise your findings.",
  "doc-searcher": "You search documentation, READMEs, comments, and external references to find relevant information.",
  "benchmark-runner": "You run benchmarks and collect quantitative data. Output structured results with methodology notes.",
  // Cross-cutting workers
  "minutes-writer": "You write structured meeting minutes from a transcript. Output: summary, decisions, action items, and @mentions.",
  compactor: "You compact long conversation transcripts into a shorter summary that preserves all decisions, action items, and open questions."
};
function buildWorkerPrompt(opts) {
  const { workerType, department, task, context, projectContext } = opts;
  const description = WORKER_DESCRIPTIONS[workerType];
  if (!description) {
    throw new Error(`Unknown worker type: ${workerType}`);
  }
  const sections = [
    `## IDENTITY

You are a **${workerType}** worker in the **${department}** department.

${description}`,
    `## TASK

${task}`
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
2. If the task is impossible or blocked, explain why clearly and stop \u2014 do not produce partial or guessed output.
3. Prefer structured output: code blocks, lists, tables.
4. Include file paths (always absolute) when referencing code.
5. When your task is complete, end with a brief summary of what you did and any caveats.
6. Respect the tool allowlist for the ${department} department \u2014 do not attempt to use tools you have not been granted.
7. Do not commit, push, or deploy. Your output will be reviewed by your leader before any permanent action is taken.`);
  return sections.join("\n\n");
}

// src/agents/agent-factory.ts
var ORCHESTRATOR_SYSTEM_PROMPT = `## IDENTITY

You are the **Orchestrator** \u2014 a proxy and router, NOT a CEO. Your job is to receive the user's request, decompose it into department-level concerns, convene meetings, and route work to the appropriate leaders. You do not make product, architecture, or engineering decisions yourself.

## CORE RESPONSIBILITIES

1. **Request analysis** \u2014 When the user submits a request, determine which departments are relevant. Most requests involve 2-4 departments.

2. **Meeting convening** \u2014 Create a meeting with an agenda derived from the request. Invite the relevant leaders. You chair the meeting but you do not dominate it.

3. **Auto-routing** \u2014 For straightforward, single-department tasks (e.g., "run the tests"), skip the full meeting flow and route directly to the responsible leader.

4. **@USER mentions** \u2014 When a leader emits @USER_DECISION_NEEDED during a meeting:
   - Pause the meeting.
   - Surface the decision to the user with full context (options, trade-offs, supporters).
   - Resume the meeting once the user responds.

5. **Progress tracking** \u2014 Monitor worker completion events. Nudge leaders if a task is overdue or failed. Report final results back to the user.

## RULES

1. You are a facilitator. Do NOT override leader recommendations unless they conflict with an explicit user instruction.
2. Keep your own token usage minimal \u2014 delegate analysis and execution to leaders and workers.
3. Always preserve the user's exact wording when forwarding a request to a meeting.
4. If the user's request is ambiguous, ask a clarifying question BEFORE convening a meeting.
5. Never modify files, run tests, or execute code directly. All execution happens through workers spawned by leaders.
6. When multiple departments disagree, facilitate resolution. Escalate to the user only when the team cannot converge after a full discussion round.
7. After a meeting completes, provide the user with a concise summary: decisions made, action items, and any pending @USER items.
8. Respect budget limits. If projected cost approaches the meeting budget, warn the user and request approval before proceeding.

## DEPARTMENT OVERVIEW

You can route work to these departments:
- **architecture** \u2014 System design, schemas, API surfaces, dependency analysis.
- **engineering** \u2014 Feature implementation, bug fixes, refactoring.
- **qa** \u2014 Testing, security audits, performance testing.
- **product** \u2014 Requirements analysis, user-flow mapping, prioritisation.
- **research** \u2014 Codebase exploration, documentation search, benchmarks.

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
function createAgentConfig(opts) {
  const { tier, role, department, task, context } = opts;
  const tierCfg = getTierConfig(tier);
  const allowedTools = [...DEPARTMENT_TOOLS[department] ?? []];
  let systemPrompt;
  switch (tier) {
    case "orchestrator": {
      systemPrompt = ORCHESTRATOR_SYSTEM_PROMPT;
      break;
    }
    case "leader": {
      systemPrompt = getLeaderSystemPrompt(department);
      break;
    }
    case "worker": {
      if (!task) {
        throw new Error("Worker agents require a task description");
      }
      systemPrompt = buildWorkerPrompt({
        workerType: role,
        department,
        task,
        context
      });
      break;
    }
    default: {
      const _exhaustive = tier;
      throw new Error(`Unknown tier: ${_exhaustive}`);
    }
  }
  const model = tier === "worker" && department === "research" ? "claude-haiku-4-5" : tierCfg.model;
  return {
    model,
    maxTurns: tierCfg.maxTurns,
    allowedTools
  };
}

// src/agents/claude-invoker.ts
import { spawn } from "child_process";
import { execSync } from "child_process";
var _claudeAvailable = null;
function isClaudeAvailable() {
  if (_claudeAvailable !== null) return _claudeAvailable;
  try {
    execSync("which claude", { stdio: "ignore" });
    _claudeAvailable = true;
  } catch {
    _claudeAvailable = false;
  }
  return _claudeAvailable;
}
function isMockMode() {
  if (process.env["COLESLAW_MOCK"] === "1") return true;
  return !isClaudeAvailable();
}
async function invokeMock(options) {
  await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 70));
  const lower = options.prompt.toLowerCase();
  let output;
  if (lower.includes("opening") || lower.includes("initial position")) {
    output = "[Mock] Acknowledged the agenda. From my department perspective, I see several important considerations. We should ensure proper separation of concerns and define clear boundaries. Key concern: we must avoid tight coupling between new and existing components.";
  } else if (lower.includes("synthesis") || lower.includes("final position")) {
    output = "[Mock] FINAL POSITION: I support the agreed approach. Action items for my department: (1) Deliver the agreed outputs, (2) Coordinate with dependent departments, (3) Report completion status once done.";
  } else if (lower.includes("discussion") || lower.includes("perspective")) {
    output = "[Mock] Building on the previous points, I propose we move forward with the discussed approach. This aligns with existing patterns and allows parallel work across departments. I can have my team start on the deliverables immediately.";
  } else if (lower.includes("schema") || lower.includes("design")) {
    output = "[Mock] Schema analysis complete. Proposed 3 tables with proper foreign-key relationships and indexes. No circular dependencies detected.";
  } else if (lower.includes("test")) {
    output = "[Mock] Test suite generated: 8 unit tests, 2 integration tests. All assertions use strict equality. Coverage target: 90%.";
  } else if (lower.includes("implement") || lower.includes("build") || lower.includes("feature")) {
    output = "[Mock] Implementation complete. Created 2 new files, modified 1 existing file. All changes follow project conventions.";
  } else if (lower.includes("research") || lower.includes("explore")) {
    output = "[Mock] Research complete. Found 5 relevant code references and 2 documentation entries. Summary provided in structured format.";
  } else if (lower.includes("security") || lower.includes("audit")) {
    output = "[Mock] Security audit complete. No critical vulnerabilities found. 1 advisory: ensure input validation on user-facing endpoints.";
  } else if (lower.includes("fix") || lower.includes("bug")) {
    output = "[Mock] Bug fix applied. Root cause identified and corrected. Fix verified with regression test.";
  } else {
    output = "[Mock] Task completed successfully. Output ready for review.";
  }
  return {
    success: true,
    output,
    costUsd: 0
  };
}
async function invokeReal(options) {
  const {
    prompt,
    systemPrompt,
    allowedTools,
    maxTurns,
    cwd,
    timeoutMs = 3e5
  } = options;
  const args = [
    "--print",
    "--output-format",
    "json",
    "--system-prompt",
    systemPrompt,
    "--no-session-persistence"
  ];
  if (allowedTools.length > 0) {
    args.push("--allowedTools", allowedTools.join(","));
  }
  args.push(prompt);
  logger.info("Invoking Claude CLI", {
    maxTurns,
    toolCount: allowedTools.length
  });
  return new Promise((resolve) => {
    const child = spawn("claude", args, {
      cwd: cwd ?? process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env }
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderrChunks.push(chunk);
    });
    const timer = setTimeout(() => {
      logger.warn("Claude CLI timed out, killing process", { timeoutMs });
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5e3);
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      const rawStdout = Buffer.concat(stdoutChunks).toString("utf-8");
      const rawStderr = Buffer.concat(stderrChunks).toString("utf-8");
      if (code !== 0) {
        logger.error("Claude CLI exited with non-zero code", {
          exitCode: String(code)
        });
        resolve({
          success: false,
          output: "",
          error: rawStderr || `Claude CLI exited with code ${code}`
        });
        return;
      }
      const parsed = parseCliOutput(rawStdout);
      logger.info("Claude CLI invocation completed", {
        outputLength: String(parsed.output.length)
      });
      resolve(parsed);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      logger.error("Failed to spawn Claude CLI", { error: err.message });
      resolve({
        success: false,
        output: "",
        error: `Failed to spawn Claude CLI: ${err.message}`
      });
    });
  });
}
function parseCliOutput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { success: false, output: "", error: "Empty output from Claude CLI" };
  }
  try {
    const json = JSON.parse(trimmed);
    if (json.is_error || json.error) {
      return {
        success: false,
        output: json.result ?? json.output ?? "",
        error: json.error ?? "Unknown CLI error",
        costUsd: json.cost_usd
      };
    }
    return {
      success: true,
      output: json.result ?? json.output ?? trimmed,
      costUsd: json.cost_usd
    };
  } catch {
    return {
      success: true,
      output: trimmed
    };
  }
}
async function invokeClaude(options) {
  if (isMockMode()) {
    if (!isClaudeAvailable()) {
      logger.warn("Claude CLI not found on PATH \u2014 using mock mode");
    } else {
      logger.info("COLESLAW_MOCK=1 set \u2014 using mock mode");
    }
    return invokeMock(options);
  }
  return invokeReal(options);
}
function buildInvokeOptions(config, prompt, systemPrompt, cwd) {
  return {
    prompt,
    systemPrompt,
    allowedTools: config.allowedTools,
    maxTurns: config.maxTurns,
    cwd
  };
}

// src/orchestrator/meeting-runner.ts
async function queryAgent(config, prompt) {
  const agentConfig = createAgentConfig({
    tier: "leader",
    role: config.role,
    department: config.department
  });
  const invokeOpts = buildInvokeOptions(
    agentConfig,
    prompt,
    config.systemPrompt
  );
  invokeOpts.timeoutMs = 6e5;
  const result = await invokeClaude(invokeOpts);
  if (!result.success) {
    logger.warn(`Agent query failed for ${config.role}: ${result.error}`);
    return `[Error from ${config.role}] ${result.error ?? "Unknown error during agent invocation"}`;
  }
  return result.output;
}
function insertTranscriptEntry(meetingId, speakerId, speakerRole, agendaItemIndex, roundNumber, content) {
  const db = getDb();
  const now = Date.now();
  const tokenCount = Math.ceil(content.length / 4);
  const result = db.prepare(
    `INSERT INTO transcript_entries
         (meeting_id, speaker_id, speaker_role, agenda_item_index, round_number, content, token_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(meetingId, speakerId, speakerRole, agendaItemIndex, roundNumber, content, tokenCount, now);
  return {
    id: Number(result.lastInsertRowid),
    meetingId,
    speakerId,
    speakerRole,
    agendaItemIndex,
    roundNumber,
    content,
    tokenCount,
    createdAt: now
  };
}
function getTranscript(meetingId) {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM transcript_entries WHERE meeting_id = ? ORDER BY created_at ASC").all(meetingId);
  return rows.map((r) => ({
    id: r.id,
    meetingId: r.meeting_id,
    speakerId: r.speaker_id,
    speakerRole: r.speaker_role,
    agendaItemIndex: r.agenda_item_index,
    roundNumber: r.round_number,
    content: r.content,
    tokenCount: r.token_count,
    createdAt: r.created_at
  }));
}
var MeetingRunner = class {
  meetingId;
  leaders;
  maxRoundsPerItem;
  projectContext;
  constructor(meetingId, leaders, projectContext) {
    this.meetingId = meetingId;
    this.leaders = leaders;
    this.maxRoundsPerItem = DEFAULT_MEETING_CONFIG.maxRoundsPerItem;
    this.projectContext = projectContext;
  }
  // ---- public entry point -------------------------------------------------
  /**
   * Run the complete meeting lifecycle: opening -> discussion -> synthesis -> minutes.
   */
  async run() {
    const meeting = getMeeting(this.meetingId);
    if (!meeting) {
      throw new Error(`Meeting not found: ${this.meetingId}`);
    }
    logger.info(`Starting meeting: ${meeting.topic}`, { meetingId: this.meetingId });
    try {
      await this.openingPhase();
      await this.discussionPhase();
      await this.synthesisPhase();
      await this.generateMinutes();
      updateMeeting(this.meetingId, {
        status: "completed",
        completedAt: Date.now()
      });
      logger.info(`Meeting completed: ${meeting.topic}`, { meetingId: this.meetingId });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Meeting failed: ${errorMsg}`, { meetingId: this.meetingId });
      updateMeeting(this.meetingId, {
        status: "failed",
        completedAt: Date.now()
      });
      throw err;
    }
  }
  // ---- phases -------------------------------------------------------------
  /**
   * Opening phase: each leader states their initial position on the meeting
   * topic and agenda.
   */
  async openingPhase() {
    this.setPhase("opening");
    const meeting = getMeeting(this.meetingId);
    const agendaText = meeting.agenda.map((a, i) => `  ${i + 1}. ${a}`).join("\n");
    for (const leader of this.leaders) {
      const prompt = `MEETING OPENING

Topic: ${meeting.topic}
Agenda:
${agendaText}

Please state your initial position on this topic from your department's perspective. Identify any concerns, dependencies, or risks relevant to your area.`;
      const config = {
        role: leader.role,
        department: leader.department,
        systemPrompt: getLeaderSystemPrompt(leader.department, void 0, this.projectContext)
      };
      const response = await queryAgent(config, prompt);
      insertTranscriptEntry(
        this.meetingId,
        leader.id,
        leader.role,
        -1,
        // -1 signals the opening phase (not tied to a specific agenda item)
        0,
        response
      );
      eventBus.emitAgentEvent({
        kind: "message_sent",
        fromId: leader.id,
        toId: "meeting",
        summary: `[Opening] ${leader.role}: ${response.slice(0, 80)}...`
      });
      logger.debug(`Opening statement from ${leader.role}`, {
        meetingId: this.meetingId,
        agentId: leader.id
      });
    }
  }
  /**
   * Discussion phase: for each agenda item, leaders take turns responding in
   * round-robin fashion for up to `maxRoundsPerItem` rounds.
   */
  async discussionPhase() {
    this.setPhase("discussion");
    const meeting = getMeeting(this.meetingId);
    for (let itemIdx = 0; itemIdx < meeting.agenda.length; itemIdx++) {
      const agendaItem = meeting.agenda[itemIdx];
      logger.info(`Discussing agenda item ${itemIdx + 1}: ${agendaItem}`, {
        meetingId: this.meetingId
      });
      for (let round = 1; round <= this.maxRoundsPerItem; round++) {
        for (const leader of this.leaders) {
          const transcript = getTranscript(this.meetingId);
          const transcriptText = this.formatTranscript(transcript);
          const prompt = `MEETING DISCUSSION \u2014 Round ${round}/${this.maxRoundsPerItem}

Current agenda item (${itemIdx + 1}/${meeting.agenda.length}): ${agendaItem}

Transcript so far:
${transcriptText}

Provide your department's perspective on this agenda item. Build on what others have said. If you agree, say so and add specifics. If you disagree, state your reasoning and propose an alternative.`;
          const config = {
            role: leader.role,
            department: leader.department,
            systemPrompt: getLeaderSystemPrompt(leader.department, void 0, this.projectContext)
          };
          const response = await queryAgent(config, prompt);
          insertTranscriptEntry(
            this.meetingId,
            leader.id,
            leader.role,
            itemIdx,
            round,
            response
          );
          eventBus.emitAgentEvent({
            kind: "message_sent",
            fromId: leader.id,
            toId: "meeting",
            summary: `[Item ${itemIdx + 1}, R${round}] ${leader.role}: ${response.slice(0, 80)}...`
          });
        }
      }
    }
  }
  /**
   * Synthesis phase: each leader states their final position, commitments,
   * and action items.
   */
  async synthesisPhase() {
    this.setPhase("synthesis");
    const transcript = getTranscript(this.meetingId);
    const transcriptText = this.formatTranscript(transcript);
    for (const leader of this.leaders) {
      const prompt = `MEETING SYNTHESIS

The discussion is complete. Here is the full transcript:
${transcriptText}

State your final position. List the action items your department commits to. Flag any unresolved concerns or items requiring user decision.`;
      const config = {
        role: leader.role,
        department: leader.department,
        systemPrompt: getLeaderSystemPrompt(leader.department, void 0, this.projectContext)
      };
      const response = await queryAgent(config, prompt);
      insertTranscriptEntry(
        this.meetingId,
        leader.id,
        leader.role,
        -2,
        // -2 signals synthesis phase
        0,
        response
      );
      eventBus.emitAgentEvent({
        kind: "message_sent",
        fromId: leader.id,
        toId: "meeting",
        summary: `[Synthesis] ${leader.role}: ${response.slice(0, 80)}...`
      });
    }
  }
  /**
   * Generate meeting minutes by concatenating and formatting the transcript.
   *
   * In the future this will use a dedicated minutes-writer agent.  For now it
   * formats the transcript into a structured summary.
   */
  async generateMinutes() {
    this.setPhase("minutes-generation");
    const meeting = getMeeting(this.meetingId);
    const transcript = getTranscript(this.meetingId);
    const sections = [];
    sections.push(`# Meeting Minutes`);
    sections.push(`## Topic: ${meeting.topic}`);
    sections.push(`## Date: ${(/* @__PURE__ */ new Date()).toISOString()}`);
    sections.push(`## Participants: ${this.leaders.map((l) => l.role).join(", ")}`);
    sections.push("");
    sections.push(`## Agenda`);
    meeting.agenda.forEach((item, i) => {
      sections.push(`${i + 1}. ${item}`);
    });
    sections.push("");
    const openingEntries = transcript.filter((e) => e.agendaItemIndex === -1);
    if (openingEntries.length > 0) {
      sections.push(`## Opening Statements`);
      for (const entry of openingEntries) {
        sections.push(`### ${entry.speakerRole}`);
        sections.push(entry.content);
        sections.push("");
      }
    }
    for (let i = 0; i < meeting.agenda.length; i++) {
      const itemEntries = transcript.filter((e) => e.agendaItemIndex === i);
      if (itemEntries.length > 0) {
        sections.push(`## Discussion: ${meeting.agenda[i]}`);
        for (const entry of itemEntries) {
          sections.push(`**${entry.speakerRole}** (round ${entry.roundNumber}):`);
          sections.push(entry.content);
          sections.push("");
        }
      }
    }
    const synthesisEntries = transcript.filter((e) => e.agendaItemIndex === -2);
    if (synthesisEntries.length > 0) {
      sections.push(`## Final Positions`);
      for (const entry of synthesisEntries) {
        sections.push(`### ${entry.speakerRole}`);
        sections.push(entry.content);
        sections.push("");
      }
    }
    const content = sections.join("\n");
    const actionItems = this.leaders.map((leader, idx) => ({
      id: `action-${this.meetingId}-${idx}`,
      title: `${leader.role} deliverables`,
      description: `Action items committed by ${leader.role} during synthesis phase`,
      assignedDepartment: leader.department,
      assignedRole: leader.role,
      priority: "medium",
      dependencies: [],
      acceptanceCriteria: ["Deliverables completed as stated in final position"]
    }));
    createMinutes({
      meetingId: this.meetingId,
      format: "summary",
      content,
      actionItems
    });
    logger.info("Minutes generated", { meetingId: this.meetingId });
  }
  // ---- helpers ------------------------------------------------------------
  setPhase(phase) {
    const statusMap = {
      "orchestrator-phase": "pending",
      "convening": "convening",
      "opening": "opening",
      "discussion": "discussion",
      "research-break": "discussion",
      "synthesis": "synthesis",
      "minutes-generation": "minutes-generation"
    };
    updateMeeting(this.meetingId, {
      phase,
      status: statusMap[phase] ?? "discussion"
    });
    logger.debug(`Meeting phase: ${phase}`, { meetingId: this.meetingId });
  }
  formatTranscript(entries) {
    if (entries.length === 0) return "(No transcript entries yet)";
    return entries.map((e) => {
      let phaseLabel;
      if (e.agendaItemIndex === -1) phaseLabel = "Opening";
      else if (e.agendaItemIndex === -2) phaseLabel = "Synthesis";
      else phaseLabel = `Item ${e.agendaItemIndex + 1}, Round ${e.roundNumber}`;
      return `[${phaseLabel}] ${e.speakerRole}: ${e.content}`;
    }).join("\n\n");
  }
};

// src/agents/project-analyzer.ts
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, basename, extname } from "path";
var CONFIG_FILE_PATTERNS = [
  "tsconfig.json",
  "tsconfig.build.json",
  "tsconfig.node.json",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  ".prettierrc",
  ".prettierrc.js",
  ".prettierrc.cjs",
  ".prettierrc.json",
  ".prettierrc.yml",
  ".prettierrc.yaml",
  "prettier.config.js",
  "prettier.config.mjs",
  "prettier.config.cjs",
  "biome.json",
  "biome.jsonc",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "webpack.config.js",
  "webpack.config.ts",
  "webpack.config.mjs",
  "rollup.config.js",
  "rollup.config.ts",
  "rollup.config.mjs",
  "tsup.config.ts",
  "tsup.config.js",
  "esbuild.config.js",
  "esbuild.config.ts",
  "jest.config.js",
  "jest.config.ts",
  "jest.config.mjs",
  "vitest.config.ts",
  "vitest.config.js",
  "vitest.config.mts",
  ".mocharc.yml",
  ".mocharc.json",
  ".mocharc.js",
  ".babelrc",
  "babel.config.js",
  "babel.config.json",
  ".swcrc",
  "turbo.json",
  "nx.json"
];
var UTIL_DIR_NAMES = ["utils", "lib", "helpers", "shared", "common"];
var MANIFEST_FILES = [
  // -- JavaScript / TypeScript --
  {
    file: "package.json",
    language: "typescript",
    // refined later if no TS config
    parse: (content) => {
      const raw = JSON.parse(content);
      return {
        dependencies: raw.dependencies ?? {},
        devDependencies: raw.devDependencies ?? {},
        scripts: raw.scripts ?? {},
        metadata: { type: raw.type ?? "commonjs", name: raw.name ?? "" }
      };
    }
  },
  // -- Python --
  {
    file: "pyproject.toml",
    language: "python",
    parse: (content) => {
      const deps = {};
      const devDeps = {};
      const scripts = {};
      for (const m of content.matchAll(/^\s*"([^"]+?)(?:[><=!~]+.*)?".*$/gm)) {
        deps[m[1]] = "*";
      }
      for (const m of content.matchAll(/^(\w[\w-]*)\s*=\s*"([^"]+)"/gm)) {
        scripts[m[1]] = m[2];
      }
      return { dependencies: deps, devDependencies: devDeps, scripts, metadata: {} };
    }
  },
  {
    file: "requirements.txt",
    language: "python",
    parse: (content) => {
      const deps = {};
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*([><=!~].*)?$/);
        if (match) deps[match[1]] = match[2]?.trim() ?? "*";
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: {} };
    }
  },
  {
    file: "Pipfile",
    language: "python",
    parse: (content) => {
      const deps = {};
      const inPackages = content.indexOf("[packages]");
      if (inPackages >= 0) {
        const section = content.slice(inPackages);
        for (const m of section.matchAll(/^(\w[\w-]*)\s*=\s*"([^"]+)"/gm)) {
          deps[m[1]] = m[2];
        }
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: {} };
    }
  },
  // -- Java / Kotlin (Gradle) --
  {
    file: "build.gradle",
    language: "java",
    parse: (content) => {
      const deps = {};
      for (const m of content.matchAll(/(?:implementation|api|compileOnly)\s+['"]([^'"]+)['"]/g)) {
        const parts = m[1].split(":");
        if (parts.length >= 2) deps[`${parts[0]}:${parts[1]}`] = parts[2] ?? "*";
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: { buildSystem: "gradle" } };
    }
  },
  {
    file: "build.gradle.kts",
    language: "kotlin",
    parse: (content) => {
      const deps = {};
      for (const m of content.matchAll(/(?:implementation|api|compileOnly)\s*\(\s*"([^"]+)"\s*\)/g)) {
        const parts = m[1].split(":");
        if (parts.length >= 2) deps[`${parts[0]}:${parts[1]}`] = parts[2] ?? "*";
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: { buildSystem: "gradle-kts" } };
    }
  },
  {
    file: "pom.xml",
    language: "java",
    parse: (content) => {
      const deps = {};
      for (const m of content.matchAll(/<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>(?:\s*<version>([^<]+)<\/version>)?/gs)) {
        deps[`${m[1]}:${m[2]}`] = m[3] ?? "*";
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: { buildSystem: "maven" } };
    }
  },
  // -- Go --
  {
    file: "go.mod",
    language: "go",
    parse: (content) => {
      const deps = {};
      for (const m of content.matchAll(/^\s+(\S+)\s+(v[\d.]+\S*)/gm)) {
        deps[m[1]] = m[2];
      }
      const moduleMatch = content.match(/^module\s+(\S+)/m);
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: { module: moduleMatch?.[1] ?? "" } };
    }
  },
  // -- Rust --
  {
    file: "Cargo.toml",
    language: "rust",
    parse: (content) => {
      const deps = {};
      const devDeps = {};
      let inDeps = false;
      let inDevDeps = false;
      for (const line of content.split("\n")) {
        if (line.match(/^\[dependencies\]/)) {
          inDeps = true;
          inDevDeps = false;
          continue;
        }
        if (line.match(/^\[dev-dependencies\]/)) {
          inDevDeps = true;
          inDeps = false;
          continue;
        }
        if (line.match(/^\[/)) {
          inDeps = false;
          inDevDeps = false;
          continue;
        }
        const m = line.match(/^(\w[\w-]*)\s*=\s*"([^"]+)"/);
        if (m) {
          if (inDeps) deps[m[1]] = m[2];
          if (inDevDeps) devDeps[m[1]] = m[2];
        }
      }
      return { dependencies: deps, devDependencies: devDeps, scripts: {}, metadata: {} };
    }
  },
  // -- Swift --
  {
    file: "Package.swift",
    language: "swift",
    parse: (content) => {
      const deps = {};
      for (const m of content.matchAll(/\.package\s*\(\s*url:\s*"([^"]+)"/g)) {
        const name = m[1].split("/").pop()?.replace(".git", "") ?? m[1];
        deps[name] = "*";
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: {} };
    }
  },
  // -- Dart / Flutter --
  {
    file: "pubspec.yaml",
    language: "dart",
    parse: (content) => {
      const deps = {};
      let inDeps = false;
      for (const line of content.split("\n")) {
        if (line.match(/^dependencies:/)) {
          inDeps = true;
          continue;
        }
        if (line.match(/^\S/) && inDeps) {
          inDeps = false;
          continue;
        }
        if (inDeps) {
          const m = line.match(/^\s+(\w[\w_-]*):\s*(.+)?/);
          if (m) deps[m[1]] = m[2]?.trim() ?? "*";
        }
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: {} };
    }
  },
  // -- Ruby --
  {
    file: "Gemfile",
    language: "ruby",
    parse: (content) => {
      const deps = {};
      for (const m of content.matchAll(/gem\s+['"]([^'"]+)['"]/g)) {
        deps[m[1]] = "*";
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: {} };
    }
  },
  // -- C# / .NET --
  {
    file: "*.csproj",
    // handled specially in the scanner
    language: "csharp",
    parse: (content) => {
      const deps = {};
      for (const m of content.matchAll(/<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g)) {
        deps[m[1]] = m[2];
      }
      return { dependencies: deps, devDependencies: {}, scripts: {}, metadata: { buildSystem: "dotnet" } };
    }
  }
];
function detectLanguage(projectDir, manifests) {
  if (manifests.length === 0) return "unknown";
  if (existsSync(join(projectDir, "tsconfig.json"))) return "typescript";
  const languages = manifests.map((m) => m.language);
  if (languages.includes("typescript")) return "typescript";
  if (languages.includes("kotlin")) return "kotlin";
  return languages[0];
}
function scanManifests(projectDir) {
  const results = [];
  for (const spec of MANIFEST_FILES) {
    if (spec.file.includes("*")) {
      const ext = spec.file.replace("*", "");
      try {
        const entries = readdirSync(projectDir);
        for (const entry of entries) {
          if (entry.endsWith(ext)) {
            const content = readFileSync(join(projectDir, entry), "utf-8");
            try {
              const parsed = spec.parse(content, projectDir);
              results.push({ file: entry, language: spec.language, ...parsed });
            } catch {
            }
          }
        }
      } catch {
      }
      continue;
    }
    const filePath = join(projectDir, spec.file);
    if (!existsSync(filePath)) continue;
    try {
      const content = readFileSync(filePath, "utf-8");
      const parsed = spec.parse(content, projectDir);
      results.push({ file: spec.file, language: spec.language, ...parsed });
    } catch {
      logger.debug(`Failed to parse manifest: ${spec.file}`);
    }
  }
  return results;
}
function readJsonSafe(filePath) {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function extractExports(filePath) {
  try {
    const content = readFileSync(filePath, "utf-8");
    const exports = [];
    for (const m of content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
      exports.push(m[1]);
    }
    for (const m of content.matchAll(/export\s+class\s+(\w+)/g)) {
      exports.push(m[1]);
    }
    for (const m of content.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g)) {
      exports.push(m[1]);
    }
    for (const m of content.matchAll(/export\s+(?:interface|type)\s+(\w+)/g)) {
      exports.push(m[1]);
    }
    for (const m of content.matchAll(/export\s+enum\s+(\w+)/g)) {
      exports.push(m[1]);
    }
    if (/export\s+default\s/.test(content)) {
      exports.push("default");
    }
    return [...new Set(exports)];
  } catch {
    return [];
  }
}
function sampleSourceFiles(dir, max) {
  const results = [];
  const extensions = /* @__PURE__ */ new Set([".ts", ".js", ".mts", ".mjs", ".cts", ".cjs"]);
  function walk(currentDir, depth) {
    if (depth > 2 || results.length >= max) return;
    let entries;
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= max) return;
      if (entry.startsWith(".") || entry === "node_modules" || entry === "dist") continue;
      const full = join(currentDir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full, depth + 1);
        } else if (stat.isFile() && extensions.has(extname(entry))) {
          results.push(full);
        }
      } catch {
      }
    }
  }
  walk(dir, 0);
  return results;
}
function detectImportStyle(projectDir, packageType) {
  const sourceDir = existsSync(join(projectDir, "src")) ? join(projectDir, "src") : projectDir;
  const files = sampleSourceFiles(sourceDir, 10);
  let esmCount = 0;
  let cjsCount = 0;
  for (const file of files) {
    try {
      const content = readFileSync(file, "utf-8");
      if (/\bimport\s+/.test(content) || /\bexport\s+/.test(content)) {
        esmCount++;
      }
      if (/\brequire\s*\(/.test(content) || /\bmodule\.exports\b/.test(content)) {
        cjsCount++;
      }
    } catch {
    }
  }
  if (esmCount === 0 && cjsCount === 0) {
    return packageType === "module" ? "esm" : "commonjs";
  }
  if (esmCount > 0 && cjsCount > 0) return "mixed";
  if (esmCount > 0) return "esm";
  return "commonjs";
}
function detectTestFramework(deps) {
  const candidates = [
    ["vitest", "vitest"],
    ["jest", "jest"],
    ["@jest/core", "jest"],
    ["mocha", "mocha"],
    ["ava", "ava"],
    ["tap", "tap"],
    ["uvu", "uvu"]
  ];
  for (const [pkg, name] of candidates) {
    if (pkg in deps) return name;
  }
  return null;
}
function detectLinter(deps, configFiles) {
  if ("biome" in deps || "@biomejs/biome" in deps || configFiles.some((f) => f.startsWith("biome."))) {
    return "biome";
  }
  if ("eslint" in deps || configFiles.some((f) => f.includes("eslint"))) {
    return "eslint";
  }
  return null;
}
function detectFormatter(deps, configFiles) {
  if ("prettier" in deps || configFiles.some((f) => f.includes("prettier"))) {
    return "prettier";
  }
  if ("biome" in deps || "@biomejs/biome" in deps || configFiles.some((f) => f.startsWith("biome."))) {
    return "biome";
  }
  return null;
}
function detectBuildTool(deps, scripts) {
  const candidates = [
    ["tsup", "tsup"],
    ["esbuild", "esbuild"],
    ["vite", "vite"],
    ["webpack", "webpack"],
    ["rollup", "rollup"],
    ["@swc/core", "swc"],
    ["turbopack", "turbopack"],
    ["parcel", "parcel"]
  ];
  for (const [pkg, name] of candidates) {
    if (pkg in deps) return name;
  }
  const buildScript = scripts["build"] ?? "";
  for (const [, name] of candidates) {
    if (buildScript.includes(name)) return name;
  }
  if (buildScript.includes("tsc")) return "tsc";
  return null;
}
function detectEntryPoints(projectDir, packageJson) {
  const entries = [];
  if (packageJson) {
    const raw = readJsonSafe(join(projectDir, "package.json"));
    if (raw) {
      if (typeof raw["main"] === "string") entries.push(raw["main"]);
      if (typeof raw["module"] === "string") entries.push(raw["module"]);
      if (raw["exports"] && typeof raw["exports"] === "object") {
        const exp = raw["exports"];
        const dot = exp["."];
        if (typeof dot === "string") {
          entries.push(dot);
        } else if (dot && typeof dot === "object") {
          const dotObj = dot;
          if (typeof dotObj["import"] === "string") entries.push(dotObj["import"]);
          if (typeof dotObj["require"] === "string") entries.push(dotObj["require"]);
        }
      }
    }
  }
  const commonEntries = ["src/index.ts", "src/main.ts", "src/index.js", "src/main.js", "index.ts", "index.js"];
  for (const candidate of commonEntries) {
    if (existsSync(join(projectDir, candidate)) && !entries.includes(candidate)) {
      entries.push(candidate);
    }
  }
  return [...new Set(entries)];
}
function collectUtilFiles(projectDir) {
  const results = [];
  const srcDir = join(projectDir, "src");
  const extensions = /* @__PURE__ */ new Set([".ts", ".js", ".mts", ".mjs"]);
  for (const dirName of UTIL_DIR_NAMES) {
    const utilDir = join(srcDir, dirName);
    if (!existsSync(utilDir)) continue;
    let entries;
    try {
      entries = readdirSync(utilDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const ext = extname(entry);
      if (!extensions.has(ext)) continue;
      if (basename(entry, ext) === "index") continue;
      const filePath = join(utilDir, entry);
      try {
        if (!statSync(filePath).isFile()) continue;
      } catch {
        continue;
      }
      const exports = extractExports(filePath);
      if (exports.length > 0) {
        const relPath = filePath.slice(projectDir.length + 1);
        results.push({ file: relPath, exports });
      }
    }
  }
  return results;
}
async function analyzeProject(projectDir) {
  logger.debug(`Analyzing project: ${projectDir}`);
  let packageJson = null;
  const pkgPath = join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    const raw = readJsonSafe(pkgPath);
    if (raw) {
      packageJson = {
        name: raw["name"] ?? "",
        dependencies: raw["dependencies"] ?? {},
        devDependencies: raw["devDependencies"] ?? {},
        scripts: raw["scripts"] ?? {},
        type: raw["type"]
      };
    }
  }
  const configFiles = [];
  for (const pattern of CONFIG_FILE_PATTERNS) {
    if (existsSync(join(projectDir, pattern))) {
      configFiles.push(pattern);
    }
  }
  const hasTypescript = existsSync(join(projectDir, "tsconfig.json")) || configFiles.some((f) => f.startsWith("tsconfig"));
  const hasSrcDir = existsSync(join(projectDir, "src"));
  const hasTestDir = existsSync(join(projectDir, "test")) || existsSync(join(projectDir, "tests")) || existsSync(join(projectDir, "__tests__"));
  const entryPoints = detectEntryPoints(projectDir, packageJson);
  const structure = {
    hasTypescript,
    hasSrcDir,
    hasTestDir,
    configFiles,
    entryPoints
  };
  const allDeps = {
    ...packageJson?.dependencies ?? {},
    ...packageJson?.devDependencies ?? {}
  };
  const patterns = {
    importStyle: detectImportStyle(projectDir, packageJson?.type),
    testFramework: detectTestFramework(allDeps),
    linter: detectLinter(allDeps, configFiles),
    formatter: detectFormatter(allDeps, configFiles),
    buildTool: detectBuildTool(allDeps, packageJson?.scripts ?? {})
  };
  const existingUtils = collectUtilFiles(projectDir);
  const manifests = scanManifests(projectDir);
  const language = detectLanguage(projectDir, manifests);
  logger.debug(`Project analysis complete: ${packageJson?.name ?? "(unnamed)"}, language: ${language}, manifests: ${manifests.length}`, {
    department: "research"
  });
  return {
    language,
    manifests,
    packageJson,
    structure,
    patterns,
    existingUtils
  };
}
function formatProjectContext(analysis) {
  const sections = [];
  sections.push("## Project Context");
  sections.push("");
  sections.push(`**Primary Language:** ${analysis.language}`);
  sections.push("");
  const nonJsManifests = analysis.manifests.filter((m) => m.file !== "package.json");
  if (nonJsManifests.length > 0) {
    sections.push("### Dependency Manifests");
    for (const manifest of nonJsManifests) {
      sections.push(`#### ${manifest.file} (${manifest.language})`);
      const depNames = Object.keys(manifest.dependencies);
      if (depNames.length > 0) {
        sections.push(depNames.slice(0, 30).map((d) => `- \`${d}\`: ${manifest.dependencies[d]}`).join("\n"));
        if (depNames.length > 30) sections.push(`- ... and ${depNames.length - 30} more`);
      }
      if (Object.keys(manifest.metadata).length > 0) {
        sections.push(`- Metadata: ${JSON.stringify(manifest.metadata)}`);
      }
      sections.push("");
    }
  }
  if (analysis.packageJson) {
    const pkg = analysis.packageJson;
    sections.push(`**Project:** ${pkg.name || "(unnamed)"}`);
    sections.push(`**Module system:** ${pkg.type ?? "commonjs (default)"}`);
    sections.push("");
    const depNames = Object.keys(pkg.dependencies);
    if (depNames.length > 0) {
      sections.push("### Dependencies");
      sections.push(depNames.map((d) => `- \`${d}\`: ${pkg.dependencies[d]}`).join("\n"));
      sections.push("");
    }
    const devDepNames = Object.keys(pkg.devDependencies);
    if (devDepNames.length > 0) {
      sections.push("### Dev Dependencies");
      sections.push(devDepNames.map((d) => `- \`${d}\`: ${pkg.devDependencies[d]}`).join("\n"));
      sections.push("");
    }
    const scriptEntries = Object.entries(pkg.scripts);
    if (scriptEntries.length > 0) {
      sections.push("### Scripts");
      sections.push(scriptEntries.map(([k, v]) => `- \`${k}\`: \`${v}\``).join("\n"));
      sections.push("");
    }
  } else {
    sections.push("*No package.json found.*");
    sections.push("");
  }
  sections.push("### Project Structure");
  sections.push(`- TypeScript: ${analysis.structure.hasTypescript ? "yes" : "no"}`);
  sections.push(`- src/ directory: ${analysis.structure.hasSrcDir ? "yes" : "no"}`);
  sections.push(`- Test directory: ${analysis.structure.hasTestDir ? "yes" : "no"}`);
  if (analysis.structure.entryPoints.length > 0) {
    sections.push(`- Entry points: ${analysis.structure.entryPoints.map((e) => `\`${e}\``).join(", ")}`);
  }
  if (analysis.structure.configFiles.length > 0) {
    sections.push(`- Config files: ${analysis.structure.configFiles.map((f) => `\`${f}\``).join(", ")}`);
  }
  sections.push("");
  sections.push("### Detected Patterns");
  sections.push(`- Import style: **${analysis.patterns.importStyle}**`);
  sections.push(`- Test framework: ${analysis.patterns.testFramework ?? "none detected"}`);
  sections.push(`- Linter: ${analysis.patterns.linter ?? "none detected"}`);
  sections.push(`- Formatter: ${analysis.patterns.formatter ?? "none detected"}`);
  sections.push(`- Build tool: ${analysis.patterns.buildTool ?? "none detected"}`);
  sections.push("");
  if (analysis.existingUtils.length > 0) {
    sections.push("### Existing Utilities (reuse before creating new ones)");
    for (const util of analysis.existingUtils) {
      sections.push(`- **\`${util.file}\`**: ${util.exports.map((e) => `\`${e}\``).join(", ")}`);
    }
    sections.push("");
  }
  sections.push("### Key Guidance");
  if (analysis.patterns.importStyle === "esm") {
    sections.push("- Use ESM imports (`import`/`export`). Use `.js` extensions in relative imports if TypeScript with bundler resolution.");
  } else if (analysis.patterns.importStyle === "commonjs") {
    sections.push("- Use CommonJS (`require`/`module.exports`).");
  } else {
    sections.push("- Mixed import styles detected. Prefer the dominant style in the module you are editing.");
  }
  if (analysis.packageJson) {
    sections.push("- Do NOT run `npm install` for packages already listed in dependencies or devDependencies.");
  }
  if (analysis.patterns.testFramework) {
    sections.push(`- Write tests using **${analysis.patterns.testFramework}** (already installed).`);
  }
  if (analysis.patterns.buildTool) {
    sections.push(`- Build with **${analysis.patterns.buildTool}** (already configured).`);
  }
  return sections.join("\n");
}

// src/orchestrator/orchestrator.ts
var DEPARTMENT_KEYWORDS = {
  architecture: [
    "architecture",
    "design",
    "schema",
    "api",
    "data model",
    "module",
    "interface",
    "contract",
    "coupling",
    "dependency graph",
    "adr",
    "system design",
    "blueprint",
    "data flow"
  ],
  engineering: [
    "code",
    "implement",
    "build",
    "feature",
    "bug",
    "fix",
    "refactor",
    "develop",
    "function",
    "class",
    "module",
    "write",
    "create",
    "modify",
    "update",
    "delete",
    "crud",
    "endpoint",
    "migration"
  ],
  qa: [
    "test",
    "quality",
    "security",
    "performance",
    "audit",
    "coverage",
    "regression",
    "benchmark",
    "vulnerability",
    "pen test",
    "lint",
    "assertion",
    "e2e",
    "integration test",
    "unit test"
  ],
  product: [
    "requirements",
    "user",
    "story",
    "priority",
    "acceptance criteria",
    "user flow",
    "stakeholder",
    "roadmap",
    "scope",
    "use case",
    "persona",
    "mvp",
    "specification"
  ],
  research: [
    "research",
    "explore",
    "investigate",
    "search",
    "analyze",
    "find",
    "discover",
    "benchmark",
    "compare",
    "survey",
    "documentation",
    "reference",
    "existing code"
  ]
};
var Orchestrator = class {
  leaderPool = new LeaderPool();
  /**
   * Internal ID for the orchestrator "agent". Used as the meeting initiator
   * and as the root of the agent tree.
   */
  orchestratorId;
  constructor(orchestratorId) {
    this.orchestratorId = orchestratorId ?? "orchestrator-root";
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
  selectLeaders(topic, agenda) {
    const corpus = [topic, ...agenda].join(" ").toLowerCase();
    const scores = /* @__PURE__ */ new Map();
    for (const [dept, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
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
      if (agenda.length >= 3) {
        logger.debug("No keyword matches; defaulting to architecture + engineering (complex topic)", {
          meetingId: topic
        });
        return ["architecture", "engineering"];
      }
      logger.debug("No keyword matches; defaulting to engineering only (simple topic)", {
        meetingId: topic
      });
      return ["engineering"];
    }
    const selected = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([dept]) => dept);
    logger.debug(`Selected departments: ${selected.join(", ")}`, { meetingId: topic });
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
  async startMeeting(opts) {
    const { topic, agenda } = opts;
    const departments = opts.departments ?? this.selectLeaders(topic, agenda);
    logger.info(`Starting meeting: "${topic}" with departments: [${departments.join(", ")}]`);
    let projectContext;
    try {
      const analysis = await analyzeProject(process.cwd());
      projectContext = formatProjectContext(analysis);
      logger.debug("Project analysis complete", { meetingId: topic });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Project analysis failed (proceeding without context): ${msg}`);
    }
    const meetingId = uuidv46();
    const meeting = createMeeting({
      id: meetingId,
      topic,
      agenda,
      participantIds: [],
      // Will be filled in after leader spawning
      initiatedBy: this.orchestratorId,
      status: "convening",
      phase: "convening",
      startedAt: Date.now(),
      previousMeetingId: opts.previousMeetingId ?? null
    });
    const leaders = [];
    for (const dept of departments) {
      const leader = this.leaderPool.spawnLeader(dept, meetingId);
      leaders.push(leader);
    }
    updateMeeting(meetingId, {
      participantIds: leaders.map((l) => l.id)
    });
    const runner = new MeetingRunner(meetingId, leaders, projectContext);
    try {
      await runner.run();
    } finally {
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
  async chainMeeting(opts) {
    const previousMeeting = getMeeting(opts.previousMeetingId);
    if (!previousMeeting) {
      throw new Error(`Previous meeting not found: ${opts.previousMeetingId}`);
    }
    const previousMinutes = getMinutesByMeeting(opts.previousMeetingId);
    if (!previousMinutes) {
      throw new Error(`No minutes found for previous meeting: ${opts.previousMeetingId}`);
    }
    const contextPrefix = `[Chained from meeting "${previousMeeting.topic}" (${opts.previousMeetingId})]

--- Previous Meeting Minutes ---
${previousMinutes.content}
--- End Previous Minutes ---

`;
    const enrichedTopic = contextPrefix + opts.topic;
    logger.info(
      `Chaining meeting from "${previousMeeting.topic}" -> "${opts.topic}"`,
      { meetingId: opts.previousMeetingId }
    );
    return this.startMeeting({
      topic: enrichedTopic,
      agenda: opts.agenda,
      departments: opts.departments,
      previousMeetingId: opts.previousMeetingId
    });
  }
  // ---- status -------------------------------------------------------------
  /**
   * Return a summary of all active meetings, pending @mentions, and the
   * current agent tree.
   */
  getStatus() {
    const allMeetings = listMeetings();
    const activeMeetings = allMeetings.filter(
      (m) => !["completed", "cancelled", "failed", "reported", "compacted"].includes(m.status)
    );
    const pendingMentions = listPendingMentions();
    const agentTree = getAgentTree(this.orchestratorId);
    return {
      activeMeetings,
      pendingMentions,
      agentTree
    };
  }
  // ---- accessors ----------------------------------------------------------
  /** The leader pool used by this orchestrator instance. */
  getLeaderPool() {
    return this.leaderPool;
  }
  /** The orchestrator's agent ID. */
  getId() {
    return this.orchestratorId;
  }
};

// src/tools/start-meeting.ts
var startMeetingSchema = {
  topic: z.string().describe("Meeting topic"),
  agenda: z.array(z.string()).describe("Agenda items"),
  departments: z.array(z.string()).optional().describe("Specific departments to invite")
};
async function startMeetingHandler({
  topic,
  agenda,
  departments
}) {
  try {
    const orchestrator = new Orchestrator();
    const meetingId = await orchestrator.startMeeting({
      topic,
      agenda,
      departments
    });
    const result = {
      meetingId,
      status: "started",
      topic,
      agenda,
      departments: departments ?? orchestrator.selectLeaders(topic, agenda)
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/get-meeting-status.ts
import { z as z2 } from "zod";
var getMeetingStatusSchema = {
  meetingId: z2.string().optional().describe("Specific meeting ID, or omit for all active")
};
async function getMeetingStatusHandler({
  meetingId
}) {
  try {
    if (meetingId) {
      const meeting = getMeeting(meetingId);
      if (!meeting) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { error: `Meeting not found: ${meetingId}` },
                null,
                2
              )
            }
          ],
          isError: true
        };
      }
      const agents = listAgentsByMeeting(meetingId);
      const workers = agents.flatMap(
        (agent) => listWorkersByLeader(agent.id)
      );
      const result2 = {
        meeting,
        agents,
        workers
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result2, null, 2) }]
      };
    }
    const allMeetings = listMeetings();
    const activeMeetings = allMeetings.filter(
      (m) => !["completed", "cancelled", "failed", "reported", "compacted"].includes(
        m.status
      )
    );
    const result = {
      totalMeetings: allMeetings.length,
      activeMeetings: activeMeetings.map((m) => ({
        id: m.id,
        topic: m.topic,
        status: m.status,
        phase: m.phase,
        startedAt: m.startedAt
      }))
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/get-minutes.ts
import { z as z3 } from "zod";
var getMinutesSchema = {
  meetingId: z3.string().describe("Meeting ID"),
  format: z3.enum(["full", "summary", "tasks_only"]).default("full").optional().describe("Output format")
};
async function getMinutesHandler({
  meetingId,
  format
}) {
  try {
    const minutes = getMinutesByMeeting(meetingId);
    if (!minutes) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: `No minutes found for meeting: ${meetingId}` },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
    const effectiveFormat = format ?? "full";
    let result;
    switch (effectiveFormat) {
      case "full":
        result = {
          id: minutes.id,
          meetingId: minutes.meetingId,
          format: minutes.format,
          content: minutes.content,
          actionItems: minutes.actionItems,
          createdAt: minutes.createdAt
        };
        break;
      case "summary": {
        const summaryContent = minutes.content.length > 500 ? minutes.content.slice(0, 500) + "..." : minutes.content;
        result = {
          id: minutes.id,
          meetingId: minutes.meetingId,
          summary: summaryContent,
          actionItemCount: minutes.actionItems.length,
          createdAt: minutes.createdAt
        };
        break;
      }
      case "tasks_only":
        result = {
          meetingId: minutes.meetingId,
          actionItems: minutes.actionItems,
          totalTasks: minutes.actionItems.length
        };
        break;
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/compact-minutes.ts
import { z as z4 } from "zod";

// src/meeting/compactor.ts
import { v4 as uuidv47 } from "uuid";
var DEPARTMENT_KEYWORDS2 = {
  architecture: [
    "schema",
    "design",
    "architecture",
    "blueprint",
    "dependency",
    "api design",
    "system design",
    "\uC544\uD0A4\uD14D\uCC98",
    "\uC124\uACC4"
  ],
  engineering: [
    "implement",
    "code",
    "develop",
    "build",
    "refactor",
    "fix",
    "feature",
    "module",
    "\uAD6C\uD604",
    "\uAC1C\uBC1C",
    "\uCF54\uB4DC"
  ],
  qa: [
    "test",
    "quality",
    "coverage",
    "security",
    "audit",
    "performance",
    "regression",
    "validation",
    "\uD14C\uC2A4\uD2B8",
    "\uAC80\uC99D",
    "\uD488\uC9C8"
  ],
  product: [
    "requirement",
    "user story",
    "acceptance criteria",
    "stakeholder",
    "priority",
    "roadmap",
    "scope",
    "\uC694\uAD6C\uC0AC\uD56D",
    "\uC0AC\uC6A9\uC790"
  ],
  research: [
    "research",
    "explore",
    "investigate",
    "benchmark",
    "compare",
    "evaluate",
    "poc",
    "prototype",
    "\uC870\uC0AC",
    "\uD0D0\uC0C9"
  ]
};
var PRIORITY_KEYWORDS = {
  critical: [
    "critical",
    "urgent",
    "blocker",
    "blocking",
    "asap",
    "immediately",
    "\uAE34\uAE09",
    "\uC989\uC2DC",
    "p0"
  ],
  high: [
    "high priority",
    "important",
    "must",
    "required",
    "essential",
    "\uC911\uC694",
    "\uD544\uC218",
    "p1"
  ],
  medium: [
    "medium",
    "should",
    "moderate",
    "\uBCF4\uD1B5",
    "p2"
  ],
  low: [
    "low priority",
    "nice to have",
    "optional",
    "consider",
    "\uB0AE\uC74C",
    "\uC120\uD0DD",
    "p3"
  ]
};
function detectDepartment(text) {
  const lower = text.toLowerCase();
  let bestDept = "engineering";
  let bestScore = 0;
  for (const [dept, keywords] of Object.entries(DEPARTMENT_KEYWORDS2)) {
    const score = keywords.reduce(
      (acc, kw) => acc + (lower.includes(kw.toLowerCase()) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      bestDept = dept;
    }
  }
  return bestDept;
}
function detectPriority(text) {
  const lower = text.toLowerCase();
  for (const priority of ["critical", "high", "medium", "low"]) {
    const keywords = PRIORITY_KEYWORDS[priority];
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return priority;
    }
  }
  return "medium";
}
var LEADER_ROLE_FOR_DEPT = {
  architecture: "arch-leader",
  engineering: "eng-leader",
  qa: "qa-leader",
  product: "pm-leader",
  research: "research-leader"
};
var Compactor = class {
  /**
   * Compact minutes into actionable, department-assigned tasks.
   *
   * 1. Load minutes for the meeting
   * 2. Parse action items from the minutes content
   * 3. Assign each to a department based on keywords
   * 4. Set priorities based on keywords
   * 5. Save updated action items to minutes record
   * 6. Return the structured task list
   */
  async compactMinutes(meetingId, additionalInstructions) {
    logger.info("Compacting minutes", { meetingId });
    const minutes = getMinutesByMeeting(meetingId);
    if (!minutes) {
      throw new Error(`No minutes found for meeting: ${meetingId}`);
    }
    const refinedItems = minutes.actionItems.map((item) => {
      const fullText = `${item.title} ${item.description} ${additionalInstructions ?? ""}`;
      const department = detectDepartment(fullText);
      const priority = detectPriority(fullText);
      return {
        ...item,
        assignedDepartment: department,
        assignedRole: LEADER_ROLE_FOR_DEPT[department],
        priority
      };
    });
    if (refinedItems.length === 0) {
      const extracted = this.extractFromContent(minutes.content);
      refinedItems.push(...extracted);
    }
    const db = getDb();
    db.prepare("UPDATE minutes SET action_items = ? WHERE id = ?").run(
      JSON.stringify(refinedItems),
      minutes.id
    );
    logger.info("Minutes compacted", {
      meetingId,
      actionItemCount: refinedItems.length
    });
    return refinedItems;
  }
  // -------------------------------------------------------------------------
  // Fallback extraction from raw minutes content
  // -------------------------------------------------------------------------
  extractFromContent(content) {
    const items = [];
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") && trimmed.length > 5 && trimmed !== "- None" && trimmed !== "- None recorded" && trimmed !== "- No action items identified" && trimmed !== "- No action items recorded") {
        const text = trimmed.slice(2);
        const department = detectDepartment(text);
        const priority = detectPriority(text);
        items.push({
          id: uuidv47(),
          title: text.slice(0, 80),
          description: text,
          assignedDepartment: department,
          assignedRole: LEADER_ROLE_FOR_DEPT[department],
          priority,
          dependencies: [],
          acceptanceCriteria: []
        });
      }
    }
    return items;
  }
};

// src/tools/compact-minutes.ts
var compactMinutesSchema = {
  meetingId: z4.string().describe("Meeting ID"),
  additionalInstructions: z4.string().optional().describe("Additional instructions for compaction")
};
async function compactMinutesHandler({
  meetingId,
  additionalInstructions
}) {
  try {
    const compactor = new Compactor();
    const tasks = await compactor.compactMinutes(
      meetingId,
      additionalInstructions
    );
    const result = {
      meetingId,
      tasksGenerated: tasks.length,
      tasks
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/execute-tasks.ts
import { z as z5 } from "zod";

// src/orchestrator/worker-manager.ts
async function executeWorkerAgent(worker) {
  const department = inferDepartment(worker);
  const workerRole = inferWorkerRole(worker);
  const agentConfig = createAgentConfig({
    tier: "worker",
    role: workerRole,
    department,
    task: worker.taskDescription,
    context: worker.inputContext ?? void 0
  });
  const systemPrompt = buildWorkerPrompt({
    workerType: workerRole,
    department,
    task: worker.taskDescription,
    context: worker.inputContext ?? void 0
  });
  const prompt = `Execute the following task:

Task: ${worker.taskDescription}
` + (worker.inputContext ? `
Context: ${worker.inputContext}
` : "") + `
Provide a clear, structured result.`;
  const invokeOpts = buildInvokeOptions(agentConfig, prompt, systemPrompt);
  invokeOpts.timeoutMs = 3e5;
  const result = await invokeClaude(invokeOpts);
  if (!result.success) {
    throw new Error(result.error ?? "Worker agent invocation failed");
  }
  return result.output;
}
function inferDepartment(worker) {
  switch (worker.taskType) {
    case "research":
      return "research";
    case "testing":
      return "qa";
    case "analysis":
      return "architecture";
    case "implementation":
    default:
      return "engineering";
  }
}
function inferWorkerRole(worker) {
  const desc = worker.taskDescription.toLowerCase();
  if (desc.includes("schema") || desc.includes("data model")) return "schema-designer";
  if (desc.includes("api") || desc.includes("endpoint")) return "api-designer";
  if (desc.includes("dependency") || desc.includes("coupling")) return "dependency-analyzer";
  if (desc.includes("test")) return "test-writer";
  if (desc.includes("security") || desc.includes("audit")) return "security-auditor";
  if (desc.includes("performance") || desc.includes("benchmark")) return "perf-tester";
  if (desc.includes("research") || desc.includes("explore") || desc.includes("investigate")) return "code-explorer";
  if (desc.includes("document") || desc.includes("search")) return "doc-searcher";
  if (desc.includes("fix") || desc.includes("bug")) return "bug-fixer";
  if (desc.includes("refactor")) return "refactorer";
  return "feature-dev";
}
function inferTaskType(description) {
  const lower = description.toLowerCase();
  if (lower.includes("research") || lower.includes("explore") || lower.includes("search")) {
    return "research";
  }
  if (lower.includes("test") || lower.includes("audit") || lower.includes("benchmark")) {
    return "testing";
  }
  if (lower.includes("analys") || lower.includes("design") || lower.includes("schema")) {
    return "analysis";
  }
  return "implementation";
}
var WorkerManager = class {
  // ---- spawn workers ------------------------------------------------------
  /**
   * Spawn a batch of workers on behalf of a leader.
   *
   * Each task assignment is persisted to SQLite and an `agent_spawned` event is
   * emitted.  The returned records are in `pending` status.
   */
  async spawnWorkers(leaderId, meetingId, tasks) {
    const workers = [];
    for (const task of tasks) {
      const worker = createWorker({
        leaderId,
        meetingId,
        taskDescription: task.description,
        taskType: inferTaskType(task.description),
        inputContext: task.inputPaths.length > 0 ? task.inputPaths.join(", ") : null,
        outputResult: null,
        errorMessage: null,
        dependencies: task.dependencies
      });
      workers.push(worker);
      logger.info(`Spawned worker for leader ${leaderId}`, {
        agentId: worker.id,
        meetingId,
        department: "worker"
      });
      eventBus.emitAgentEvent({
        kind: "agent_spawned",
        agentId: worker.id,
        agentType: "worker",
        parentId: leaderId,
        label: task.description.slice(0, 60),
        department: "engineering"
        // Workers inherit; refined later if needed
      });
    }
    return workers;
  }
  // ---- execute workers ----------------------------------------------------
  /**
   * Execute a list of workers, respecting dependency ordering.
   *
   * - Workers with no unresolved dependencies run in parallel.
   * - Workers whose dependencies are all completed run next.
   * - Continues until all workers are done or a dependency cycle is detected.
   */
  async executeWorkers(workers) {
    const completed = /* @__PURE__ */ new Set();
    const results = [];
    const pending = new Map(workers.map((w) => [w.id, w]));
    while (pending.size > 0) {
      const ready = [];
      for (const worker of pending.values()) {
        const depsReady = worker.dependencies.every((dep) => completed.has(dep));
        if (depsReady) {
          ready.push(worker);
        }
      }
      if (ready.length === 0) {
        logger.warn("Dependency cycle or unsatisfiable deps detected; failing remaining workers");
        for (const worker of pending.values()) {
          const failed = updateWorker(worker.id, {
            status: "failed",
            errorMessage: "Unresolvable dependency",
            completedAt: Date.now()
          });
          results.push(failed ?? worker);
          eventBus.emitAgentEvent({
            kind: "task_completed",
            agentId: worker.id,
            result: "failure"
          });
        }
        break;
      }
      const batchResults = await Promise.allSettled(
        ready.map(async (worker) => {
          updateWorker(worker.id, { status: "running" });
          eventBus.emitAgentEvent({
            kind: "state_changed",
            agentId: worker.id,
            from: "idle",
            to: "working"
          });
          try {
            const output = await executeWorkerAgent(worker);
            const updated = updateWorker(worker.id, {
              status: "completed",
              outputResult: output,
              completedAt: Date.now(),
              costUsd: 0.01
              // Approximate cost; real cost tracked by CLI
            });
            eventBus.emitAgentEvent({
              kind: "task_completed",
              agentId: worker.id,
              result: "success"
            });
            return updated ?? worker;
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const updated = updateWorker(worker.id, {
              status: "failed",
              errorMessage: errorMsg,
              completedAt: Date.now()
            });
            eventBus.emitAgentEvent({
              kind: "task_completed",
              agentId: worker.id,
              result: "failure"
            });
            return updated ?? worker;
          }
        })
      );
      for (let i = 0; i < ready.length; i++) {
        const worker = ready[i];
        pending.delete(worker.id);
        completed.add(worker.id);
        const settlement = batchResults[i];
        if (settlement.status === "fulfilled") {
          results.push(settlement.value);
        } else {
          results.push(worker);
        }
      }
    }
    return results;
  }
  // ---- status query -------------------------------------------------------
  /**
   * Get the current status of all workers under a given leader.
   */
  getWorkerStatus(leaderId) {
    return listWorkersByLeader(leaderId);
  }
};

// src/tools/execute-tasks.ts
var executeTasksSchema = {
  meetingId: z5.string().describe("Meeting ID"),
  taskIds: z5.array(z5.string()).optional().describe("Specific tasks to execute, or all")
};
async function executeTasksHandler({
  meetingId,
  taskIds
}) {
  try {
    const allTasks = getTasksFromMinutes(meetingId);
    if (allTasks.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `No tasks found for meeting: ${meetingId}. Run compact-minutes first.`
              },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
    const tasksToExecute = taskIds ? allTasks.filter((t) => taskIds.includes(t.id)) : allTasks;
    if (tasksToExecute.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: "No matching tasks found for the provided task IDs." },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
    const tasksByDepartment = /* @__PURE__ */ new Map();
    for (const task of tasksToExecute) {
      const dept = task.assignedDepartment;
      if (!tasksByDepartment.has(dept)) {
        tasksByDepartment.set(dept, []);
      }
      tasksByDepartment.get(dept).push(task);
    }
    const workerManager = new WorkerManager();
    const executionResults = [];
    for (const [department, tasks] of tasksByDepartment) {
      const assignments = tasks.map((task) => ({
        workerId: task.id,
        description: `${task.title}: ${task.description}`,
        inputPaths: [],
        outputPath: "",
        dependencies: task.dependencies,
        status: "pending",
        result: null
      }));
      const leaderId = `${department}-leader-${meetingId}`;
      const workers = await workerManager.spawnWorkers(
        leaderId,
        meetingId,
        assignments
      );
      const completedWorkers = await workerManager.executeWorkers(workers);
      executionResults.push({
        department,
        taskCount: tasks.length,
        workers: completedWorkers.map((w) => ({
          id: w.id,
          status: w.status,
          taskDescription: w.taskDescription,
          outputResult: w.outputResult,
          errorMessage: w.errorMessage
        }))
      });
    }
    const totalWorkers = executionResults.reduce(
      (acc, r) => acc + r.workers.length,
      0
    );
    const completedCount = executionResults.reduce(
      (acc, r) => acc + r.workers.filter((w) => w.status === "completed").length,
      0
    );
    const failedCount = executionResults.reduce(
      (acc, r) => acc + r.workers.filter((w) => w.status === "failed").length,
      0
    );
    const result = {
      meetingId,
      summary: {
        totalTasks: tasksToExecute.length,
        totalWorkers,
        completed: completedCount,
        failed: failedCount
      },
      departments: executionResults
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/get-agent-tree.ts
async function getAgentTreeHandler() {
  try {
    const tree = getAgentTree("orchestrator-root");
    const result = {
      root: tree,
      hasAgents: tree !== null
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/respond-to-mention.ts
import { z as z6 } from "zod";
var respondToMentionSchema = {
  mentionId: z6.string().describe("ID of the mention to respond to"),
  decision: z6.string().describe("The decision made by the user"),
  reasoning: z6.string().optional().describe("Optional reasoning for the decision")
};
async function respondToMentionHandler({
  mentionId,
  decision,
  reasoning
}) {
  try {
    const mention = getMention(mentionId);
    if (!mention) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: `Mention not found: ${mentionId}` },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
    if (mention.status === "resolved") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: `Mention already resolved: ${mentionId}` },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
    const resolved = updateMention(mentionId, {
      status: "resolved",
      userDecision: decision,
      userReasoning: reasoning ?? null,
      resolvedAt: Date.now()
    });
    eventBus.emitAgentEvent({
      kind: "mention_resolved",
      mentionId,
      decision
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { success: true, mention: resolved },
            null,
            2
          )
        }
      ]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/get-mentions.ts
import { z as z7 } from "zod";
var getMentionsSchema = {
  status: z7.enum(["pending", "resolved", "all"]).default("pending").optional().describe("Filter mentions by status"),
  meetingId: z7.string().optional().describe("Filter mentions by meeting ID")
};
async function getMentionsHandler({
  status,
  meetingId
}) {
  try {
    const effectiveStatus = status ?? "pending";
    let mentions;
    if (meetingId) {
      const allForMeeting = listMentionsByMeeting(meetingId);
      if (effectiveStatus === "all") {
        mentions = allForMeeting;
      } else {
        mentions = allForMeeting.filter((m) => m.status === effectiveStatus);
      }
    } else if (effectiveStatus === "pending") {
      mentions = listPendingMentions();
    } else if (effectiveStatus === "resolved") {
      const { getDb: getDb2 } = await import("./db-S2POLBQM.js");
      const db = getDb2();
      const rows = db.prepare("SELECT * FROM mentions WHERE status = 'resolved' ORDER BY created_at ASC").all();
      mentions = rows.map((row) => ({
        id: row.id,
        meetingId: row.meeting_id,
        agendaItem: row.agenda_item,
        summary: row.summary,
        options: JSON.parse(row.options),
        urgency: row.urgency,
        status: row.status,
        userDecision: row.user_decision,
        userReasoning: row.user_reasoning,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at
      }));
    } else {
      const { getDb: getDb2 } = await import("./db-S2POLBQM.js");
      const db = getDb2();
      const rows = db.prepare("SELECT * FROM mentions ORDER BY created_at ASC").all();
      mentions = rows.map((row) => ({
        id: row.id,
        meetingId: row.meeting_id,
        agendaItem: row.agenda_item,
        summary: row.summary,
        options: JSON.parse(row.options),
        urgency: row.urgency,
        status: row.status,
        userDecision: row.user_decision,
        userReasoning: row.user_reasoning,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at
      }));
    }
    const result = {
      count: mentions.length,
      status: effectiveStatus,
      ...meetingId ? { meetingId } : {},
      mentions
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/cancel-meeting.ts
import { z as z8 } from "zod";
var cancelMeetingSchema = {
  meetingId: z8.string().describe("ID of the meeting to cancel"),
  reason: z8.string().optional().describe("Reason for cancellation")
};
async function cancelMeetingHandler({
  meetingId,
  reason
}) {
  try {
    const meeting = getMeeting(meetingId);
    if (!meeting) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: `Meeting not found: ${meetingId}` },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
    if (meeting.status === "completed" || meeting.status === "cancelled") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `Meeting cannot be cancelled: current status is '${meeting.status}'`
              },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
    updateMeeting(meetingId, { status: "cancelled", completedAt: Date.now() });
    const agents = listAgentsByMeeting(meetingId);
    let agentsCancelled = 0;
    let workersFailed = 0;
    for (const agent of agents) {
      if (agent.status !== "completed" && agent.status !== "failed") {
        updateAgent(agent.id, { status: "completed", completedAt: Date.now() });
        agentsCancelled++;
        eventBus.emitAgentEvent({
          kind: "state_changed",
          agentId: agent.id,
          from: agent.status,
          to: "completed"
        });
      }
      const workers = listWorkersByLeader(agent.id);
      for (const worker of workers) {
        if (worker.status !== "completed" && worker.status !== "failed") {
          updateWorker(worker.id, {
            status: "failed",
            errorMessage: reason ?? "Meeting cancelled",
            completedAt: Date.now()
          });
          workersFailed++;
          eventBus.emitAgentEvent({
            kind: "task_completed",
            agentId: worker.id,
            result: "failure"
          });
        }
      }
    }
    const result = {
      success: true,
      meetingId,
      previousStatus: meeting.status,
      reason: reason ?? "No reason provided",
      agentsCancelled,
      workersFailed
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/list-meetings.ts
import { z as z9 } from "zod";
var listMeetingsSchema = {
  status: z9.enum(["pending", "running", "completed", "cancelled", "failed", "all"]).default("all").optional().describe("Filter meetings by status"),
  limit: z9.number().default(20).optional().describe("Maximum number of meetings to return")
};
var RUNNING_STATUSES = [
  "convening",
  "opening",
  "discussion",
  "synthesis",
  "minutes-generation",
  "executing",
  "aggregation",
  "waiting-for-user"
];
async function listMeetingsHandler({
  status,
  limit
}) {
  try {
    const effectiveStatus = status ?? "all";
    const effectiveLimit = limit ?? 20;
    let meetings;
    if (effectiveStatus === "all") {
      meetings = listMeetings();
    } else if (effectiveStatus === "running") {
      const all = listMeetings();
      meetings = all.filter((m) => RUNNING_STATUSES.includes(m.status));
    } else {
      meetings = listMeetings(effectiveStatus);
    }
    const limited = meetings.slice(0, effectiveLimit);
    const result = {
      total: meetings.length,
      returned: limited.length,
      status: effectiveStatus,
      meetings: limited.map((m) => ({
        id: m.id,
        topic: m.topic,
        status: m.status,
        phase: m.phase,
        participantCount: m.participantIds.length,
        startedAt: m.startedAt
      }))
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/get-task-report.ts
import { z as z10 } from "zod";
var getTaskReportSchema = {
  meetingId: z10.string().describe("ID of the meeting to generate a report for")
};
async function getTaskReportHandler({
  meetingId
}) {
  try {
    const meeting = getMeeting(meetingId);
    if (!meeting) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: `Meeting not found: ${meetingId}` },
              null,
              2
            )
          }
        ],
        isError: true
      };
    }
    const minutes = getMinutesByMeeting(meetingId);
    const agents = listAgentsByMeeting(meetingId);
    const departmentBreakdowns = [];
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalPending = 0;
    let totalCost = 0;
    for (const agent of agents) {
      const workers = listWorkersByLeader(agent.id);
      const completed = workers.filter((w) => w.status === "completed").length;
      const failed = workers.filter((w) => w.status === "failed").length;
      const pending = workers.filter(
        (w) => w.status === "pending" || w.status === "running"
      ).length;
      const deptCost = workers.reduce((acc, w) => acc + w.costUsd, 0);
      totalCompleted += completed;
      totalFailed += failed;
      totalPending += pending;
      totalCost += deptCost;
      if (workers.length > 0) {
        departmentBreakdowns.push({
          department: agent.department,
          leaderId: agent.id,
          leaderRole: agent.role,
          workers: workers.map((w) => ({
            id: w.id,
            taskDescription: w.taskDescription,
            status: w.status,
            costUsd: w.costUsd,
            errorMessage: w.errorMessage
          })),
          completed,
          failed,
          pending,
          totalCost: deptCost
        });
      }
    }
    const result = {
      meetingId,
      topic: meeting.topic,
      status: meeting.status,
      actionItemCount: minutes?.actionItems.length ?? 0,
      summary: {
        totalWorkers: totalCompleted + totalFailed + totalPending,
        completed: totalCompleted,
        failed: totalFailed,
        pending: totalPending,
        totalCost
      },
      departments: departmentBreakdowns
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/create-capability.ts
import { z as z11 } from "zod";

// src/extension/capability-registry.ts
import { readFileSync as readFileSync2, writeFileSync, existsSync as existsSync2 } from "fs";
import { join as join3 } from "path";

// src/utils/config.ts
import { mkdirSync } from "fs";
import { homedir } from "os";
import { join as join2 } from "path";
function buildConfig() {
  const DATA_DIR = join2(homedir(), ".open-coleslaw");
  return {
    DATA_DIR,
    DB_PATH: join2(DATA_DIR, "data.db"),
    MINUTES_DIR: join2(DATA_DIR, "minutes"),
    DASHBOARD_PORT: 35143
  };
}
var _config = null;
function getConfig() {
  if (!_config) {
    _config = buildConfig();
  }
  return _config;
}
function ensureDataDirs() {
  const config = getConfig();
  mkdirSync(config.DATA_DIR, { recursive: true });
  mkdirSync(config.MINUTES_DIR, { recursive: true });
}

// src/extension/capability-registry.ts
var BUILT_IN_HOOKS = [
  {
    type: "hook",
    name: "pre-read",
    description: "Loads rules + plugin guide + CLAUDE.md/README before execution",
    trigger: "Before every execution",
    isBuiltIn: true,
    filePath: "src/hooks/pre-read.ts"
  },
  {
    type: "hook",
    name: "auto-route",
    description: "Analyzes user prompts and auto-routes to appropriate skill/agent",
    trigger: "On every user prompt",
    isBuiltIn: true,
    filePath: "src/hooks/auto-route.ts"
  },
  {
    type: "hook",
    name: "auto-commit",
    description: "Creates conventional commits after task completion",
    trigger: "After task completion when git is connected",
    isBuiltIn: true,
    filePath: "src/hooks/auto-commit.ts"
  },
  {
    type: "hook",
    name: "doc-update",
    description: "Updates CLAUDE.md/README.md after process completion",
    trigger: "After process completion",
    isBuiltIn: true,
    filePath: "src/hooks/doc-update.ts"
  },
  {
    type: "hook",
    name: "flow-verify",
    description: "Verifies PRD user flows after development",
    trigger: "After development phase completes",
    isBuiltIn: true,
    filePath: "src/hooks/flow-verify.ts"
  },
  {
    type: "hook",
    name: "mvp-cycle",
    description: "Triggers re-meeting on verification failure",
    trigger: "When flow-verify reports failure",
    isBuiltIn: true,
    filePath: "src/hooks/mvp-cycle.ts"
  }
];
var BUILT_IN_SKILLS = [
  {
    type: "skill",
    name: "meeting",
    description: "Start a meeting (auto-selects leaders if topic given)",
    trigger: "/meeting [topic]",
    isBuiltIn: true,
    filePath: "src/skills/meeting.ts"
  },
  {
    type: "skill",
    name: "status",
    description: "Show current meetings, agents, and pending mentions",
    trigger: "/status",
    isBuiltIn: true,
    filePath: "src/skills/status.ts"
  },
  {
    type: "skill",
    name: "dashboard",
    description: "Open web dashboard at http://localhost:35143",
    trigger: "/dashboard",
    isBuiltIn: true,
    filePath: "src/skills/dashboard.ts"
  },
  {
    type: "skill",
    name: "mention",
    description: "View and respond to pending @mentions",
    trigger: "/mention",
    isBuiltIn: true,
    filePath: "src/skills/mention.ts"
  },
  {
    type: "skill",
    name: "agents",
    description: "Show full agent hierarchy tree",
    trigger: "/agents",
    isBuiltIn: true,
    filePath: "src/skills/agents.ts"
  },
  {
    type: "skill",
    name: "minutes",
    description: "View meeting minutes",
    trigger: "/minutes [meetingId]",
    isBuiltIn: true,
    filePath: "src/skills/minutes.ts"
  }
];
var CapabilityRegistry = class {
  capabilities = [];
  registryPath;
  constructor() {
    const { DATA_DIR } = getConfig();
    this.registryPath = join3(DATA_DIR, "registry.json");
  }
  /**
   * Load all capabilities: built-in (hardcoded) + custom (from registry.json).
   */
  async loadAll() {
    const builtIns = [
      ...BUILT_IN_HOOKS,
      ...BUILT_IN_SKILLS
    ].map((cap) => ({ ...cap, createdAt: 0 }));
    const custom = this.readCustomEntries();
    this.capabilities = [...builtIns, ...custom];
    return this.capabilities;
  }
  /**
   * Register a new custom capability and persist.
   */
  async register(cap) {
    const entry = { ...cap, createdAt: Date.now() };
    const custom = this.readCustomEntries().filter((c) => c.name !== cap.name);
    custom.push(entry);
    this.writeCustomEntries(custom);
    await this.loadAll();
  }
  /**
   * Unregister a custom capability and persist.
   */
  async unregister(type, name) {
    const custom = this.readCustomEntries().filter(
      (c) => !(c.type === type && c.name === name)
    );
    this.writeCustomEntries(custom);
    await this.loadAll();
  }
  /**
   * Find capabilities by type.
   */
  findByType(type) {
    return this.capabilities.filter((c) => c.type === type);
  }
  /**
   * Find a capability by name.
   */
  findByName(name) {
    return this.capabilities.find((c) => c.name === name);
  }
  /**
   * Check whether a capability with the given name exists.
   */
  has(name) {
    return this.capabilities.some((c) => c.name === name);
  }
  /**
   * Format all capabilities as a human-readable list suitable for plugin-guide.md.
   */
  formatForGuide() {
    const sections = [];
    const types = ["hook", "skill", "command", "asset", "loop"];
    for (const type of types) {
      const caps = this.findByType(type);
      if (caps.length === 0) continue;
      const label = type.charAt(0).toUpperCase() + type.slice(1) + "s";
      const lines = caps.map((c) => {
        const tag = c.isBuiltIn ? "" : " [custom]";
        return `- **${c.name}**${tag} \u2014 ${c.description} (trigger: ${c.trigger})`;
      });
      sections.push(`### ${label}
${lines.join("\n")}`);
    }
    return sections.join("\n\n");
  }
  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------
  readCustomEntries() {
    if (!existsSync2(this.registryPath)) {
      return [];
    }
    try {
      const raw = readFileSync2(this.registryPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }
  writeCustomEntries(entries) {
    writeFileSync(this.registryPath, JSON.stringify(entries, null, 2), "utf-8");
  }
};

// src/extension/generator.ts
import { mkdirSync as mkdirSync2, writeFileSync as writeFileSync2 } from "fs";
import { join as join4 } from "path";
function sanitizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function header(request) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return [
    `// Auto-generated by open-coleslaw extension system`,
    `// Name: ${request.name}`,
    `// Description: ${request.description}`,
    `// Trigger: ${request.trigger}`,
    `// Created: ${now}`,
    ""
  ].join("\n");
}
function customDir(type) {
  const { DATA_DIR } = getConfig();
  const dir = join4(DATA_DIR, `custom-${type}s`);
  mkdirSync2(dir, { recursive: true });
  return dir;
}
function generateHook(request) {
  return [
    header(request),
    `/**`,
    ` * Custom hook: ${request.name}`,
    ` * ${request.description}`,
    ` *`,
    ` * Trigger: ${request.trigger}`,
    ` * Original request: ${request.userRequest}`,
    ` *`,
    ` * Usage:`,
    ` *   node custom-hooks/${sanitizeName(request.name)}.js`,
    ` */`,
    ``,
    `function main() {`,
    `  // Read input from stdin or environment if needed`,
    `  const input = process.env.HOOK_INPUT ?? '';`,
    ``,
    `  // TODO: Implement hook logic for "${request.description}"`,
    `  const result = {`,
    `    hook: '${request.name}',`,
    `    status: 'executed',`,
    `    input,`,
    `    timestamp: new Date().toISOString(),`,
    `  };`,
    ``,
    `  process.stdout.write(JSON.stringify(result));`,
    `}`,
    ``,
    `main();`,
    ``
  ].join("\n");
}
function generateSkill(request) {
  return [
    header(request),
    `/**`,
    ` * Custom skill: ${request.name}`,
    ` * ${request.description}`,
    ` *`,
    ` * Trigger: ${request.trigger}`,
    ` * Original request: ${request.userRequest}`,
    ` */`,
    ``,
    `export function get${toPascalCase(request.name)}SkillPrompt(args) {`,
    `  const input = args?.trim() ?? '';`,
    ``,
    `  return [`,
    `    '<command-name>${request.name}</command-name>',`,
    `    '',`,
    `    '## ${request.name} Skill',`,
    `    '',`,
    `    '${request.description}',`,
    `    '',`,
    `    input ? \`User input: \${input}\` : 'No input provided.',`,
    `    '',`,
    `    'Instructions:',`,
    `    '1. Analyze the user request',`,
    `    '2. Perform the action described above',`,
    `    '3. Report the result to the user',`,
    `  ].join('\\n');`,
    `}`,
    ``
  ].join("\n");
}
function generateCommand(request) {
  return [
    header(request),
    `/**`,
    ` * Custom command: ${request.name}`,
    ` * ${request.description}`,
    ` *`,
    ` * Trigger: ${request.trigger}`,
    ` * Original request: ${request.userRequest}`,
    ` *`,
    ` * Usage:`,
    ` *   node custom-commands/${sanitizeName(request.name)}.js [action] [args...]`,
    ` */`,
    ``,
    `function main() {`,
    `  const args = process.argv.slice(2);`,
    `  const action = args[0] ?? 'default';`,
    `  const rest = args.slice(1);`,
    ``,
    `  const handlers = {`,
    `    default: () => ({`,
    `      command: '${request.name}',`,
    `      description: '${request.description}',`,
    `      usage: '${request.name}:action [args]',`,
    `    }),`,
    `    run: () => {`,
    `      // TODO: Implement the primary command action`,
    `      return {`,
    `        command: '${request.name}',`,
    `        action: 'run',`,
    `        args: rest,`,
    `        status: 'executed',`,
    `        timestamp: new Date().toISOString(),`,
    `      };`,
    `    },`,
    `  };`,
    ``,
    `  const handler = handlers[action] ?? handlers.default;`,
    `  const result = handler();`,
    `  process.stdout.write(JSON.stringify(result, null, 2));`,
    `}`,
    ``,
    `main();`,
    ``
  ].join("\n");
}
function generateAsset(request) {
  const isMarkdown = /template|guide|doc|readme|note/i.test(request.name) || /template|guide|doc|readme|note/i.test(request.description);
  if (isMarkdown) {
    return [
      `<!-- Auto-generated by open-coleslaw extension system -->`,
      `<!-- Name: ${request.name} -->`,
      `<!-- Description: ${request.description} -->`,
      `<!-- Trigger: ${request.trigger} -->`,
      `<!-- Created: ${(/* @__PURE__ */ new Date()).toISOString()} -->`,
      ``,
      `# ${request.name}`,
      ``,
      `${request.description}`,
      ``,
      `## Details`,
      ``,
      `> Original request: ${request.userRequest}`,
      ``,
      `<!-- TODO: Fill in content -->`,
      ``
    ].join("\n");
  }
  const data = {
    _meta: {
      generatedBy: "open-coleslaw extension system",
      name: request.name,
      description: request.description,
      trigger: request.trigger,
      created: (/* @__PURE__ */ new Date()).toISOString(),
      userRequest: request.userRequest
    },
    config: {}
  };
  return JSON.stringify(data, null, 2) + "\n";
}
function generateLoop(request) {
  return [
    header(request),
    `/**`,
    ` * Custom loop: ${request.name}`,
    ` * ${request.description}`,
    ` *`,
    ` * Trigger: ${request.trigger}`,
    ` * Original request: ${request.userRequest}`,
    ` *`,
    ` * Usage:`,
    ` *   node custom-loops/${sanitizeName(request.name)}.js`,
    ` */`,
    ``,
    `const INTERVAL_MS = 30000; // 30 seconds`,
    `const MAX_ITERATIONS = 100;`,
    ``,
    `async function check() {`,
    `  // TODO: Implement the condition check for "${request.description}"`,
    `  const result = {`,
    `    loop: '${request.name}',`,
    `    iteration: 0,`,
    `    timestamp: new Date().toISOString(),`,
    `    conditionMet: false,`,
    `  };`,
    `  return result;`,
    `}`,
    ``,
    `async function main() {`,
    `  let iteration = 0;`,
    ``,
    `  while (iteration < MAX_ITERATIONS) {`,
    `    iteration++;`,
    `    const result = await check();`,
    `    result.iteration = iteration;`,
    ``,
    `    process.stdout.write(JSON.stringify(result) + '\\n');`,
    ``,
    `    if (result.conditionMet) {`,
    `      process.stdout.write(JSON.stringify({`,
    `        loop: '${request.name}',`,
    `        status: 'completed',`,
    `        totalIterations: iteration,`,
    `      }) + '\\n');`,
    `      break;`,
    `    }`,
    ``,
    `    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));`,
    `  }`,
    `}`,
    ``,
    `main().catch((err) => {`,
    `  process.stderr.write(String(err));`,
    `  process.exit(1);`,
    `});`,
    ``
  ].join("\n");
}
function toPascalCase(str) {
  return str.split(/[-_\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("");
}
function generateCapability(request) {
  const safeName = sanitizeName(request.name);
  const isAssetMarkdown = request.type === "asset" && (/template|guide|doc|readme|note/i.test(request.name) || /template|guide|doc|readme|note/i.test(request.description));
  let ext;
  if (request.type === "asset") {
    ext = isAssetMarkdown ? ".md" : ".json";
  } else {
    ext = ".js";
  }
  const dir = customDir(request.type);
  const filePath = join4(dir, `${safeName}${ext}`);
  let code;
  switch (request.type) {
    case "hook":
      code = generateHook(request);
      break;
    case "skill":
      code = generateSkill(request);
      break;
    case "command":
      code = generateCommand(request);
      break;
    case "asset":
      code = generateAsset(request);
      break;
    case "loop":
      code = generateLoop(request);
      break;
  }
  writeFileSync2(filePath, code, "utf-8");
  return {
    filePath,
    code,
    registryEntry: {
      type: request.type,
      name: request.name,
      description: request.description,
      trigger: request.trigger,
      isBuiltIn: false,
      filePath
    }
  };
}

// src/extension/guide-updater.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "fs";
import { join as join5 } from "path";
async function updatePluginGuide(registry) {
  const { DATA_DIR } = getConfig();
  const guidePath = join5(DATA_DIR, "plugin-guide.md");
  const capSection = registry.formatForGuide();
  const guide = [
    "# Open-Coleslaw Plugin Guide",
    "",
    "## Overview",
    "Multi-agent orchestrator for Claude Code. Hierarchical agent system:",
    "Orchestrator (proxy) -> Part Leaders (team leads) -> Workers (executors)",
    "",
    "## Registered Capabilities",
    "",
    capSection,
    "",
    "## Agent Tiers",
    "| Tier | Model | Role |",
    "|------|-------|------|",
    "| Orchestrator | claude-opus-4-6 (1M) | Full-picture routing, delegation |",
    "| Leader | claude-sonnet-4-6 | Meetings, technical decisions |",
    "| Worker (impl) | claude-sonnet-4-6 | Code, implementation |",
    "| Worker (research) | claude-haiku-4-5 | Quick lookups |",
    "",
    "## Departments",
    "- Architecture: system design, API, schema",
    "- Engineering: implementation, code quality",
    "- QA: testing, security, performance",
    "- Product: requirements, user stories",
    "- Research: codebase exploration, docs",
    "",
    "## Meeting Minutes",
    "Saved to: ~/.open-coleslaw/minutes/",
    "Index: ~/.open-coleslaw/minutes/INDEX.md",
    "Format: PRD with frontmatter metadata + tags",
    "",
    "## Extension System",
    "Custom capabilities are stored in ~/.open-coleslaw/custom-{type}s/.",
    "Use the `create-capability` MCP tool to add new hooks, skills, commands, assets, or loops.",
    "Registry: ~/.open-coleslaw/registry.json",
    ""
  ].join("\n");
  writeFileSync3(guidePath, guide, "utf-8");
}

// src/extension/extension-manager.ts
var KEYWORD_RULES = [
  {
    type: "hook",
    patterns: [
      /\bevery\s+time\b/i,
      /\balways\b/i,
      /\bbefore\s+\w+/i,
      /\bafter\s+\w+/i,
      /\bwhen\s+\w+/i,
      /\bon\s+(every|each)\b/i
    ]
  },
  {
    type: "skill",
    patterns: [
      /\/\w+/,
      /\bslash\s+command\b/i,
      /\bshortcut\b/i,
      /\bskill\b/i
    ]
  },
  {
    type: "asset",
    patterns: [
      /\btemplate\b/i,
      /\bconfig\b/i,
      /\bsettings\b/i,
      /\bconfiguration\b/i
    ]
  },
  {
    type: "loop",
    patterns: [
      /\bcheck\s+every\b/i,
      /\bpoll\b/i,
      /\bwatch\b/i,
      /\bmonitor\b/i,
      /\brepeatedly\b/i,
      /\bperiodically\b/i
    ]
  }
];
var ExtensionManager = class {
  registry;
  constructor() {
    this.registry = new CapabilityRegistry();
  }
  /**
   * Initialize: load the registry from disk.
   */
  async init() {
    await this.registry.loadAll();
  }
  /**
   * Analyze a user request to decide whether a new capability is needed.
   *
   * Uses keyword matching to suggest the capability type. Returns
   * `needsNewCapability: false` when the request matches an existing
   * capability name.
   */
  async analyzeRequest(request) {
    const normalized = request.toLowerCase().trim();
    for (const cap of await this.registry.loadAll()) {
      if (normalized.includes(cap.name.toLowerCase())) {
        return { needsNewCapability: false };
      }
    }
    for (const rule of KEYWORD_RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(request)) {
          const nameCandidate = extractName(request);
          return {
            needsNewCapability: true,
            suggestedType: rule.type,
            suggestedName: nameCandidate,
            suggestedDescription: request.slice(0, 120),
            suggestedTrigger: extractTrigger(request, rule.type)
          };
        }
      }
    }
    return {
      needsNewCapability: true,
      suggestedType: "command",
      suggestedName: extractName(request),
      suggestedDescription: request.slice(0, 120),
      suggestedTrigger: "On user invocation"
    };
  }
  /**
   * Create a new capability, persist it, and update the plugin guide.
   */
  async createCapability(request) {
    const result = generateCapability(request);
    await this.registry.register(result.registryEntry);
    await updatePluginGuide(this.registry);
    const capability = {
      ...result.registryEntry,
      createdAt: Date.now()
    };
    const summary = `Created ${request.type} "${request.name}": ${request.description}. File: ${result.filePath}`;
    return { capability, filePath: result.filePath, summary };
  }
  /**
   * List all capabilities (built-in + custom).
   */
  async listCapabilities() {
    return this.registry.loadAll();
  }
  /**
   * Remove a custom capability by name.
   *
   * Built-in capabilities cannot be removed.
   */
  async removeCapability(name) {
    const cap = this.registry.findByName(name);
    if (!cap) {
      throw new Error(`Capability not found: ${name}`);
    }
    if (cap.isBuiltIn) {
      throw new Error(`Cannot remove built-in capability: ${name}`);
    }
    await this.registry.unregister(cap.type, name);
    await updatePluginGuide(this.registry);
  }
};
function extractName(request) {
  const slashMatch = request.match(/\/(\w[\w-]*)/);
  if (slashMatch) return slashMatch[1];
  const words = request.replace(/[^a-zA-Z0-9\s-]/g, "").split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
  return words.join("-").toLowerCase() || "unnamed";
}
function extractTrigger(request, type) {
  switch (type) {
    case "hook": {
      const beforeMatch = request.match(/before\s+(\w[\w\s]{0,30})/i);
      if (beforeMatch) return `Before ${beforeMatch[1].trim()}`;
      const afterMatch = request.match(/after\s+(\w[\w\s]{0,30})/i);
      if (afterMatch) return `After ${afterMatch[1].trim()}`;
      const whenMatch = request.match(/when\s+(\w[\w\s]{0,30})/i);
      if (whenMatch) return `When ${whenMatch[1].trim()}`;
      return "On configured trigger";
    }
    case "skill":
      return `/${extractName(request)}`;
    case "loop": {
      const everyMatch = request.match(/every\s+([\w\s]+)/i);
      if (everyMatch) return `Every ${everyMatch[1].trim()}`;
      return "On interval";
    }
    case "asset":
      return "When referenced";
    case "command":
      return "On user invocation";
  }
}

// src/tools/create-capability.ts
var createCapabilitySchema = {
  type: z11.enum(["hook", "skill", "command", "asset", "loop"]).describe("Type of capability to create"),
  name: z11.string().describe("Name for the new capability"),
  description: z11.string().describe("What the capability does"),
  trigger: z11.string().describe("When the capability should be triggered"),
  userRequest: z11.string().optional().describe("Original user request that triggered creation")
};
async function createCapabilityHandler({
  type,
  name,
  description,
  trigger,
  userRequest
}) {
  try {
    const manager = new ExtensionManager();
    await manager.init();
    const request = {
      type,
      name,
      description,
      trigger,
      userRequest: userRequest ?? description
    };
    const result = await manager.createCapability(request);
    const output = {
      status: "created",
      capability: {
        type: result.capability.type,
        name: result.capability.name,
        description: result.capability.description,
        trigger: result.capability.trigger,
        isBuiltIn: result.capability.isBuiltIn
      },
      filePath: result.filePath,
      summary: result.summary
    };
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/get-cost-summary.ts
import { z as z12 } from "zod";

// src/utils/cost-tracker.ts
var CostTracker = class {
  budgetLimitUsd = null;
  entries = [];
  /** Set a budget limit in USD. */
  setBudget(limitUsd) {
    this.budgetLimitUsd = limitUsd;
  }
  /** Record a cost for an agent action. */
  recordCost(agentId, meetingId, costUsd) {
    this.entries.push({
      agentId,
      meetingId,
      costUsd,
      recordedAt: Date.now()
    });
  }
  /** Get the current cost summary, combining in-memory entries with DB data. */
  getSummary(meetingId) {
    const byMeeting = {};
    const byDepartment = {};
    const byTier = {};
    let totalUsd = 0;
    try {
      const db = getDb();
      let agentRows;
      if (meetingId) {
        agentRows = db.prepare("SELECT meeting_id, department, tier, cost_usd FROM agents WHERE meeting_id = ?").all(meetingId);
      } else {
        agentRows = db.prepare("SELECT meeting_id, department, tier, cost_usd FROM agents").all();
      }
      for (const row of agentRows) {
        const cost = row.cost_usd ?? 0;
        if (cost === 0) continue;
        totalUsd += cost;
        const mid = row.meeting_id ?? "unknown";
        byMeeting[mid] = (byMeeting[mid] ?? 0) + cost;
        byDepartment[row.department] = (byDepartment[row.department] ?? 0) + cost;
        byTier[row.tier] = (byTier[row.tier] ?? 0) + cost;
      }
      let workerRows;
      if (meetingId) {
        workerRows = db.prepare("SELECT meeting_id, cost_usd, leader_id FROM workers WHERE meeting_id = ?").all(meetingId);
      } else {
        workerRows = db.prepare("SELECT meeting_id, cost_usd, leader_id FROM workers").all();
      }
      for (const row of workerRows) {
        const cost = row.cost_usd ?? 0;
        if (cost === 0) continue;
        totalUsd += cost;
        byMeeting[row.meeting_id] = (byMeeting[row.meeting_id] ?? 0) + cost;
        byTier["worker"] = (byTier["worker"] ?? 0) + cost;
        const leader = db.prepare("SELECT department FROM agents WHERE id = ?").get(row.leader_id);
        if (leader) {
          byDepartment[leader.department] = (byDepartment[leader.department] ?? 0) + cost;
        }
      }
    } catch {
    }
    const filteredEntries = meetingId ? this.entries.filter((e) => e.meetingId === meetingId) : this.entries;
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
      budgetRemaining: this.budgetLimitUsd !== null ? this.budgetLimitUsd - totalUsd : null
    };
  }
  /** Check if over budget. Returns a warning message or null. */
  checkBudget() {
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
};
var costTracker = new CostTracker();

// src/tools/get-cost-summary.ts
var getCostSummarySchema = {
  meetingId: z12.string().optional().describe("Optional meeting ID to filter costs")
};
async function getCostSummaryHandler({
  meetingId
}) {
  try {
    const summary = costTracker.getSummary(meetingId);
    const budgetWarning = costTracker.checkBudget();
    const result = {
      ...summary
    };
    if (budgetWarning) {
      result.budgetWarning = budgetWarning;
    }
    if (meetingId) {
      result.filteredByMeeting = meetingId;
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/tools/chain-meeting.ts
import { z as z13 } from "zod";
var chainMeetingSchema = {
  previousMeetingId: z13.string().describe("ID of the previous meeting to chain from"),
  topic: z13.string().describe("Topic for the new chained meeting"),
  agenda: z13.array(z13.string()).describe("Agenda items for the new meeting"),
  departments: z13.array(z13.string()).optional().describe("Specific departments to invite")
};
async function chainMeetingHandler({
  previousMeetingId,
  topic,
  agenda,
  departments
}) {
  try {
    const orchestrator = new Orchestrator();
    const meetingId = await orchestrator.chainMeeting({
      previousMeetingId,
      topic,
      agenda,
      departments
    });
    const result = {
      meetingId,
      status: "started",
      chainedFrom: previousMeetingId,
      topic,
      agenda,
      departments: departments ?? orchestrator.selectLeaders(topic, agenda)
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: JSON.stringify({ error: message }, null, 2) }
      ],
      isError: true
    };
  }
}

// src/server.ts
function createServer() {
  const server = new McpServer({
    name: "open-coleslaw",
    version: "0.1.0"
  });
  server.tool(
    "start-meeting",
    "Start a new multi-agent meeting on a topic with agenda items",
    startMeetingSchema,
    startMeetingHandler
  );
  server.tool(
    "get-meeting-status",
    "Get the status of a specific meeting or all active meetings",
    getMeetingStatusSchema,
    getMeetingStatusHandler
  );
  server.tool(
    "get-minutes",
    "Retrieve meeting minutes in full, summary, or tasks-only format",
    getMinutesSchema,
    getMinutesHandler
  );
  server.tool(
    "compact-minutes",
    "Compact meeting minutes into a structured, department-assigned task list",
    compactMinutesSchema,
    compactMinutesHandler
  );
  server.tool(
    "execute-tasks",
    "Execute tasks from compacted minutes by spawning workers per department",
    executeTasksSchema,
    executeTasksHandler
  );
  server.tool(
    "get-agent-tree",
    "Return the full agent hierarchy tree",
    getAgentTreeHandler
  );
  server.tool(
    "respond-to-mention",
    "Respond to a pending @mention with a decision",
    respondToMentionSchema,
    respondToMentionHandler
  );
  server.tool(
    "get-mentions",
    "List @mentions filtered by status and/or meeting",
    getMentionsSchema,
    getMentionsHandler
  );
  server.tool(
    "cancel-meeting",
    "Cancel an active meeting and clean up its agents and workers",
    cancelMeetingSchema,
    cancelMeetingHandler
  );
  server.tool(
    "list-meetings",
    "List meetings with optional status filter and pagination",
    listMeetingsSchema,
    listMeetingsHandler
  );
  server.tool(
    "get-task-report",
    "Generate a task execution report for a meeting with per-department breakdown",
    getTaskReportSchema,
    getTaskReportHandler
  );
  server.tool(
    "create-capability",
    "Create a new extension capability (hook, skill, command, asset, or loop)",
    createCapabilitySchema,
    createCapabilityHandler
  );
  server.tool(
    "get-cost-summary",
    "Get cost summary for a specific meeting or overall across all meetings",
    getCostSummarySchema,
    getCostSummaryHandler
  );
  server.tool(
    "chain-meeting",
    "Start a new meeting chained from a previous meeting, using its minutes as context",
    chainMeetingSchema,
    chainMeetingHandler
  );
  return server;
}

// src/dashboard/server.ts
import { createServer as createHttpServer } from "http";
import { WebSocketServer } from "ws";

// src/dashboard/html.ts
function getDashboardHTML() {
  return (
    /* html */
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Open Coleslaw Dashboard</title>

<!-- CDN deps -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.30.4/cytoscape.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/dagre/0.8.5/dagre.min.js"></script>
<script src="https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js"></script>

<!-- Google Fonts: JetBrains Mono -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

<style>
/* ===================================================================
   RESET & VARIABLES
   =================================================================== */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:          #0a0e17;
  --surface:     #111827;
  --border:      #1e293b;
  --cyan:        #00f0ff;
  --purple:      #a855f7;
  --lightcyan:   #22d3ee;
  --success:     #10b981;
  --warning:     #f59e0b;
  --error:       #ef4444;
  --text:        #e2e8f0;
  --text2:       #94a3b8;
  --font:        'JetBrains Mono', 'Fira Code', monospace;
}

html, body {
  width: 100%; height: 100%;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  line-height: 1.5;
}

/* ===================================================================
   LAYOUT \u2014 four areas via CSS Grid
   =================================================================== */
#app {
  display: grid;
  width: 100%; height: 100%;
  grid-template-rows: 48px 1fr 200px;
  grid-template-columns: 1fr 320px;
  grid-template-areas:
    "header  header"
    "graph   sidebar"
    "log     log";
}

/* ===================================================================
   HEADER
   =================================================================== */
#header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  gap: 16px;
  z-index: 10;
}

#header .brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: var(--cyan);
  text-shadow: 0 0 12px rgba(0,240,255,0.5);
  white-space: nowrap;
}

#header .center-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.conn-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--error);
  transition: background 0.3s;
  box-shadow: 0 0 6px rgba(239,68,68,0.6);
}
.conn-dot.connected {
  background: var(--success);
  box-shadow: 0 0 6px rgba(16,185,129,0.6);
}
.conn-dot.reconnecting {
  background: var(--warning);
  box-shadow: 0 0 6px rgba(245,158,11,0.6);
  animation: breathe 1.5s ease-in-out infinite;
}

#header .right-stats {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
}

.badge {
  background: rgba(0,240,255,0.1);
  border: 1px solid rgba(0,240,255,0.25);
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 11px;
  white-space: nowrap;
}
.badge.purple { background: rgba(168,85,247,0.1); border-color: rgba(168,85,247,0.3); }
.badge.amber  { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.3); color: var(--warning); }
.badge.green  { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: var(--success); }

/* ===================================================================
   GRAPH VIEWPORT
   =================================================================== */
#graph-container {
  grid-area: graph;
  background: var(--bg);
  position: relative;
  overflow: hidden;
}
#cy {
  width: 100%; height: 100%;
}
/* watermark text */
#graph-container::after {
  content: 'AGENT GRAPH';
  position: absolute;
  bottom: 12px; left: 16px;
  font-size: 10px;
  color: rgba(148,163,184,0.25);
  letter-spacing: 3px;
  pointer-events: none;
}

/* ===================================================================
   SIDEBAR
   =================================================================== */
#sidebar {
  grid-area: sidebar;
  background: var(--surface);
  border-left: 1px solid var(--border);
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

#sidebar h2 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--text2);
  margin-bottom: 4px;
}

.sidebar-empty {
  color: var(--text2);
  font-style: italic;
  font-size: 12px;
  margin-top: 40px;
  text-align: center;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.detail-row .label { color: var(--text2); }
.detail-row .value { color: var(--text); font-weight: 500; }

.status-chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}
.status-chip.idle        { background: rgba(148,163,184,0.15); color: var(--text2); }
.status-chip.working     { background: rgba(0,240,255,0.15); color: var(--cyan); }
.status-chip.in-meeting  { background: rgba(245,158,11,0.15); color: var(--warning); }
.status-chip.spawning-workers { background: rgba(168,85,247,0.15); color: var(--purple); }
.status-chip.aggregating { background: rgba(34,211,238,0.15); color: var(--lightcyan); }
.status-chip.waiting-for-user { background: rgba(245,158,11,0.15); color: var(--warning); }
.status-chip.completed   { background: rgba(16,185,129,0.15); color: var(--success); }
.status-chip.failed      { background: rgba(239,68,68,0.15); color: var(--error); }

.task-block {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
  font-size: 12px;
  color: var(--text2);
  line-height: 1.6;
  max-height: 160px;
  overflow-y: auto;
}

/* Children list */
.children-list {
  list-style: none;
  padding: 0;
  font-size: 12px;
}
.children-list li {
  padding: 3px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.children-list li::before {
  content: '';
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--lightcyan);
}

/* Task history */
#task-history {
  max-height: 250px;
  overflow-y: auto;
}
.history-item {
  font-size: 11px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(30,41,59,0.5);
  color: var(--text2);
}

/* ===================================================================
   EVENT LOG
   =================================================================== */
#event-log {
  grid-area: log;
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#event-log .log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--text2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
#event-log .log-header .pause-indicator {
  color: var(--warning);
  font-weight: 600;
  display: none;
}
#event-log .log-header .pause-indicator.visible {
  display: inline;
}

#log-entries {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  font-size: 12px;
  scroll-behavior: smooth;
}

.log-entry {
  display: flex;
  gap: 12px;
  padding: 3px 16px;
  border-bottom: 1px solid rgba(30,41,59,0.3);
  align-items: baseline;
}
.log-entry:hover { background: rgba(255,255,255,0.02); }

.log-time {
  color: var(--text2);
  font-size: 11px;
  flex-shrink: 0;
  min-width: 64px;
}
.log-kind {
  font-weight: 600;
  flex-shrink: 0;
  min-width: 100px;
  font-size: 11px;
}
.log-msg {
  color: var(--text);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Kind colours */
.log-kind.spawn    { color: var(--cyan); }
.log-kind.destroy  { color: var(--error); }
.log-kind.state    { color: var(--purple); }
.log-kind.task     { color: var(--lightcyan); }
.log-kind.done     { color: var(--success); }
.log-kind.msg      { color: var(--text); }
.log-kind.mention  { color: var(--error); }
.log-kind.resolved { color: var(--success); }
.log-kind.cost     { color: var(--warning); }

/* ===================================================================
   ANIMATIONS
   =================================================================== */
@keyframes breathe {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1; }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 4px rgba(0,240,255,0.3); }
  50%      { box-shadow: 0 0 18px rgba(0,240,255,0.7); }
}
@keyframes amber-pulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1.0; }
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #334155; }
</style>
</head>
<body>

<div id="app">
  <!-- HEADER ------------------------------------------------------------ -->
  <header id="header">
    <div class="brand">
      <span style="font-size:22px">&#x1F96C;</span>
      <span>Open Coleslaw</span>
    </div>
    <div class="center-status">
      <span class="conn-dot" id="conn-dot"></span>
      <span id="conn-label">Connecting...</span>
    </div>
    <div class="right-stats">
      <span class="badge" id="badge-agents">0 agents</span>
      <span class="badge purple" id="badge-meeting">No meeting</span>
      <span class="badge green" id="badge-cost">$0.0000</span>
    </div>
  </header>

  <!-- GRAPH ------------------------------------------------------------- -->
  <div id="graph-container">
    <div id="cy"></div>
  </div>

  <!-- SIDEBAR ----------------------------------------------------------- -->
  <aside id="sidebar">
    <h2>Agent Details</h2>
    <div class="sidebar-empty" id="sidebar-empty">Click a node to inspect</div>
    <div id="sidebar-content" style="display:none;"></div>
  </aside>

  <!-- EVENT LOG --------------------------------------------------------- -->
  <div id="event-log">
    <div class="log-header">
      <span>Event Log</span>
      <span class="pause-indicator" id="log-pause">PAUSED (scroll up)</span>
    </div>
    <div id="log-entries"></div>
  </div>
</div>

<script>
// ======================================================================
// IIFE \u2014 all dashboard JS
// ======================================================================
(function () {
  'use strict';

  // ====================================================================
  // 1. STATE STORE
  // ====================================================================
  const StateStore = {
    agents: new Map(),    // id -> AgentState
    edges: [],            // EdgeState[]
    meeting: null,        // MeetingState | null
    totalCost: 0,
    selectedAgentId: null,
    eventHistory: [],     // {kind, agentId, ...}[]

    applySnapshot(data) {
      this.agents.clear();
      (data.agents || []).forEach(a => this.agents.set(a.id, a));
      this.edges = data.edges || [];
      this.meeting = data.meeting || null;
      StatusBar.update();
    },

    applyDelta(data) {
      (data.events || []).forEach(ev => this.applyEvent(ev));
      StatusBar.update();
    },

    applyEvent(ev) {
      this.eventHistory.push(ev);
      EventLog.append(ev);

      switch (ev.kind) {
        case 'agent_spawned': {
          const agent = {
            id: ev.agentId,
            type: ev.agentType,
            label: ev.label,
            status: 'idle',
            parentId: ev.parentId,
            department: ev.department,
            currentTask: null,
            costUsd: 0,
          };
          this.agents.set(ev.agentId, agent);

          GraphRenderer.addNode(agent);

          if (ev.parentId) {
            const edge = {
              id: 'edge-' + ev.parentId + '-' + ev.agentId,
              source: ev.parentId,
              target: ev.agentId,
              edgeType: 'hierarchy',
              active: true,
              label: '',
            };
            this.edges.push(edge);
            GraphRenderer.addEdge(edge);
          }
          break;
        }
        case 'agent_destroyed': {
          this.agents.delete(ev.agentId);
          this.edges = this.edges.filter(e => e.source !== ev.agentId && e.target !== ev.agentId);
          GraphRenderer.removeNode(ev.agentId);
          if (this.selectedAgentId === ev.agentId) {
            this.selectedAgentId = null;
            SidebarPanel.clear();
          }
          break;
        }
        case 'state_changed': {
          const a = this.agents.get(ev.agentId);
          if (a) { a.status = ev.to; GraphRenderer.updateNode(a); }
          break;
        }
        case 'task_assigned': {
          const a = this.agents.get(ev.agentId);
          if (a) { a.currentTask = ev.taskSummary; a.status = 'working'; GraphRenderer.updateNode(a); }
          break;
        }
        case 'task_completed': {
          const a = this.agents.get(ev.agentId);
          if (a) { a.currentTask = null; a.status = ev.result === 'success' ? 'completed' : 'failed'; GraphRenderer.updateNode(a); }
          break;
        }
        case 'message_sent': {
          const edgeId = 'msg-' + ev.fromId + '-' + ev.toId + '-' + Date.now();
          const edge = { id: edgeId, source: ev.fromId, target: ev.toId, edgeType: 'message', active: true, label: ev.summary };
          this.edges.push(edge);
          GraphRenderer.addEdge(edge);
          setTimeout(() => {
            this.edges = this.edges.filter(e => e.id !== edgeId);
            GraphRenderer.removeEdge(edgeId);
          }, 5000);
          break;
        }
        case 'mention_created': {
          break;
        }
        case 'mention_resolved': {
          break;
        }
        case 'cost_update': {
          this.totalCost = ev.totalCost;
          break;
        }
      }

      // Refresh sidebar if the selected agent was affected
      if (this.selectedAgentId) {
        const agentId = ev.agentId || ev.fromId || ev.toId || null;
        if (agentId === this.selectedAgentId) {
          SidebarPanel.show(this.selectedAgentId);
        }
      }
    },
  };

  // ====================================================================
  // 2. CONNECTION MANAGER \u2014 WebSocket with exponential backoff
  // ====================================================================
  const ConnectionManager = {
    ws: null,
    backoff: 1000,
    maxBackoff: 30000,
    timer: null,

    connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const url = proto + '://' + location.host;
      this.ws = new WebSocket(url);
      this.setStatus('reconnecting');

      this.ws.onopen = () => {
        this.backoff = 1000;
        this.setStatus('connected');
      };

      this.ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === 'snapshot') {
            StateStore.applySnapshot(data);
            GraphRenderer.rebuild();
          } else if (data.type === 'delta') {
            StateStore.applyDelta(data);
          } else if (data.type === 'pong') {
            // heartbeat response
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // onclose will fire after this
      };

      // Heartbeat every 25s
      this._heartbeat = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    },

    scheduleReconnect() {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.backoff = Math.min(this.backoff * 2, this.maxBackoff);
        this.connect();
      }, this.backoff);
    },

    setStatus(status) {
      const dot = document.getElementById('conn-dot');
      const label = document.getElementById('conn-label');
      dot.className = 'conn-dot';
      if (status === 'connected') {
        dot.classList.add('connected');
        label.textContent = 'Connected';
      } else if (status === 'reconnecting') {
        dot.classList.add('reconnecting');
        label.textContent = 'Connecting...';
      } else {
        label.textContent = 'Disconnected';
      }
    },
  };

  // ====================================================================
  // 3. GRAPH RENDERER \u2014 Cytoscape.js
  // ====================================================================
  const GraphRenderer = {
    cy: null,

    init() {
      this.cy = cytoscape({
        container: document.getElementById('cy'),
        style: [
          // --- NODES ---
          {
            selector: 'node',
            style: {
              'label': 'data(label)',
              'text-valign': 'bottom',
              'text-halign': 'center',
              'text-margin-y': 8,
              'font-family': "'JetBrains Mono', monospace",
              'font-size': 10,
              'color': '#94a3b8',
              'text-outline-width': 0,
              'background-color': '#1e293b',
              'border-width': 2,
              'border-color': '#334155',
              'width': 40,
              'height': 40,
              'transition-property': 'background-color, border-color, border-width, opacity, width, height',
              'transition-duration': '0.3s',
            },
          },
          // Orchestrator
          {
            selector: 'node[tier="orchestrator"]',
            style: {
              'width': 60,
              'height': 60,
              'border-width': 3,
              'border-color': '#00f0ff',
              'background-color': 'rgba(0,240,255,0.1)',
              'color': '#00f0ff',
              'font-size': 12,
              'font-weight': '700',
              'text-outline-color': '#0a0e17',
              'text-outline-width': 2,
            },
          },
          // Leader
          {
            selector: 'node[tier="leader"]',
            style: {
              'width': 48,
              'height': 48,
              'border-width': 2,
              'border-color': '#a855f7',
              'background-color': 'rgba(168,85,247,0.1)',
              'color': '#a855f7',
              'font-size': 11,
              'font-weight': '600',
            },
          },
          // Worker
          {
            selector: 'node[tier="worker"]',
            style: {
              'width': 36,
              'height': 36,
              'border-width': 2,
              'border-color': '#22d3ee',
              'background-color': 'rgba(34,211,238,0.08)',
              'color': '#22d3ee',
              'font-size': 10,
            },
          },
          // Status: idle
          {
            selector: 'node[status="idle"]',
            style: {
              'opacity': 0.5,
              'border-color': '#475569',
            },
          },
          // Status: working / executing
          {
            selector: 'node[status="working"]',
            style: {
              'border-width': 3,
              'opacity': 1,
            },
          },
          // Status: in-meeting
          {
            selector: 'node[status="in-meeting"]',
            style: {
              'border-color': '#f59e0b',
              'background-color': 'rgba(245,158,11,0.1)',
              'opacity': 1,
            },
          },
          // Status: spawning-workers
          {
            selector: 'node[status="spawning-workers"]',
            style: {
              'border-color': '#a855f7',
              'opacity': 1,
            },
          },
          // Status: waiting-for-user
          {
            selector: 'node[status="waiting-for-user"]',
            style: {
              'border-color': '#f59e0b',
              'opacity': 0.8,
            },
          },
          // Status: aggregating
          {
            selector: 'node[status="aggregating"]',
            style: {
              'border-color': '#22d3ee',
              'opacity': 1,
            },
          },
          // Status: completed
          {
            selector: 'node[status="completed"]',
            style: {
              'border-color': '#10b981',
              'background-color': 'rgba(16,185,129,0.1)',
              'opacity': 0.7,
            },
          },
          // Status: failed
          {
            selector: 'node[status="failed"]',
            style: {
              'border-color': '#ef4444',
              'background-color': 'rgba(239,68,68,0.1)',
              'opacity': 0.8,
            },
          },
          // Selected node
          {
            selector: 'node:selected',
            style: {
              'border-width': 4,
              'overlay-padding': 6,
              'overlay-color': '#00f0ff',
              'overlay-opacity': 0.08,
            },
          },
          // --- EDGES ---
          {
            selector: 'edge',
            style: {
              'width': 1.5,
              'line-color': '#334155',
              'target-arrow-color': '#334155',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.8,
              'curve-style': 'bezier',
              'opacity': 0.5,
              'transition-property': 'line-color, opacity, width',
              'transition-duration': '0.3s',
            },
          },
          // Active hierarchy edges
          {
            selector: 'edge[edgeType="hierarchy"][?active]',
            style: {
              'line-color': '#475569',
              'target-arrow-color': '#475569',
              'line-style': 'solid',
              'opacity': 0.6,
              'width': 1.5,
            },
          },
          // Delegation edges
          {
            selector: 'edge[edgeType="delegation"]',
            style: {
              'line-color': '#a855f7',
              'target-arrow-color': '#a855f7',
              'line-style': 'dashed',
              'line-dash-pattern': [8, 4],
              'opacity': 0.8,
              'width': 2,
            },
          },
          // Report edges
          {
            selector: 'edge[edgeType="report"]',
            style: {
              'line-color': '#10b981',
              'target-arrow-color': '#10b981',
              'opacity': 0.8,
              'width': 2,
            },
          },
          // Message edges
          {
            selector: 'edge[edgeType="message"]',
            style: {
              'line-color': '#22d3ee',
              'target-arrow-color': '#22d3ee',
              'line-style': 'dashed',
              'line-dash-pattern': [6, 3],
              'opacity': 0.7,
              'width': 1.5,
            },
          },
          // Mention edges
          {
            selector: 'edge[edgeType="mention"]',
            style: {
              'line-color': '#ef4444',
              'target-arrow-color': '#ef4444',
              'line-style': 'dashed',
              'line-dash-pattern': [4, 4],
              'opacity': 0.9,
              'width': 2.5,
            },
          },
        ],
        layout: { name: 'preset' },
        minZoom: 0.3,
        maxZoom: 3,
        wheelSensitivity: 0.3,
      });

      // Click handling
      this.cy.on('tap', 'node', function (evt) {
        const id = evt.target.id();
        StateStore.selectedAgentId = id;
        SidebarPanel.show(id);
      });

      this.cy.on('tap', function (evt) {
        if (evt.target === GraphRenderer.cy) {
          StateStore.selectedAgentId = null;
          SidebarPanel.clear();
        }
      });

      // Start animations
      this.startAnimations();
    },

    rebuild() {
      if (!this.cy) return;
      this.cy.elements().remove();

      StateStore.agents.forEach(agent => {
        this.cy.add({
          group: 'nodes',
          data: {
            id: agent.id,
            label: agent.label,
            tier: agent.type,
            status: agent.status,
            department: agent.department,
          },
        });
      });

      StateStore.edges.forEach(edge => {
        // Only add if source and target exist
        if (this.cy.getElementById(edge.source).length && this.cy.getElementById(edge.target).length) {
          this.cy.add({
            group: 'edges',
            data: {
              id: edge.id,
              source: edge.source,
              target: edge.target,
              edgeType: edge.edgeType,
              active: edge.active,
            },
          });
        }
      });

      this.runLayout();
    },

    runLayout() {
      if (!this.cy || this.cy.nodes().length === 0) return;
      this.cy.layout({
        name: 'dagre',
        rankDir: 'TB',
        rankSep: 80,
        nodeSep: 40,
        edgeSep: 20,
        animate: true,
        animationDuration: 500,
        animationEasing: 'ease-out',
        padding: 40,
      }).run();
    },

    addNode(agent) {
      if (!this.cy) return;
      this.cy.add({
        group: 'nodes',
        data: {
          id: agent.id,
          label: agent.label,
          tier: agent.type,
          status: agent.status,
          department: agent.department,
        },
      });
      // Re-layout after a short delay to batch additions
      clearTimeout(this._layoutTimer);
      this._layoutTimer = setTimeout(() => this.runLayout(), 200);
    },

    removeNode(id) {
      if (!this.cy) return;
      const node = this.cy.getElementById(id);
      if (node.length) {
        node.animate({ style: { opacity: 0 } }, { duration: 300, complete: () => node.remove() });
      }
    },

    updateNode(agent) {
      if (!this.cy) return;
      const node = this.cy.getElementById(agent.id);
      if (node.length) {
        node.data('status', agent.status);
        node.data('label', agent.label);
      }
    },

    addEdge(edge) {
      if (!this.cy) return;
      if (!this.cy.getElementById(edge.source).length || !this.cy.getElementById(edge.target).length) return;
      if (this.cy.getElementById(edge.id).length) return; // already exists
      this.cy.add({
        group: 'edges',
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          edgeType: edge.edgeType,
          active: edge.active,
        },
      });
    },

    removeEdge(id) {
      if (!this.cy) return;
      const el = this.cy.getElementById(id);
      if (el.length) el.remove();
    },

    // Edge dash animation
    _animFrame: null,
    _dashOffset: 0,
    startAnimations() {
      const animate = () => {
        this._dashOffset += 0.5;
        if (this.cy) {
          this.cy.edges('[edgeType="delegation"], [edgeType="message"], [edgeType="mention"]').forEach(edge => {
            const base = edge.data('edgeType') === 'mention' ? [4, 4] : [8, 4];
            edge.style('line-dash-offset', -this._dashOffset);
          });

          // Pulse glow for working nodes
          const t = Date.now();
          this.cy.nodes('[status="working"]').forEach(node => {
            const glow = 2 + Math.sin(t / 400) * 1;
            node.style('border-width', glow);
          });
          this.cy.nodes('[status="in-meeting"]').forEach(node => {
            const op = 0.4 + (Math.sin(t / 1000) + 1) * 0.3;
            node.style('opacity', op);
          });
          this.cy.nodes('[status="waiting-for-user"]').forEach(node => {
            const op = 0.5 + (Math.sin(t / 1500) + 1) * 0.25;
            node.style('opacity', op);
          });
          this.cy.nodes('[status="spawning-workers"]').forEach(node => {
            const c = Math.sin(t / 600) > 0 ? '#a855f7' : '#22d3ee';
            node.style('border-color', c);
          });
        }
        this._animFrame = requestAnimationFrame(animate);
      };
      this._animFrame = requestAnimationFrame(animate);
    },
  };

  // ====================================================================
  // 4. SIDEBAR PANEL
  // ====================================================================
  const SidebarPanel = {
    show(agentId) {
      const agent = StateStore.agents.get(agentId);
      if (!agent) { this.clear(); return; }

      document.getElementById('sidebar-empty').style.display = 'none';
      const el = document.getElementById('sidebar-content');
      el.style.display = 'block';

      // Find children
      const children = [];
      StateStore.agents.forEach(a => {
        if (a.parentId === agentId) children.push(a);
      });

      // Find related events
      const recentEvents = StateStore.eventHistory
        .filter(ev => (ev.agentId === agentId || ev.fromId === agentId || ev.toId === agentId))
        .slice(-10)
        .reverse();

      const tierIcon = agent.type === 'orchestrator' ? '&#x1F3AF;' : agent.type === 'leader' ? '&#x1F451;' : '&#x2699;&#xFE0F;';

      el.innerHTML =
        '<div style="text-align:center;margin-bottom:8px;">' +
          '<span style="font-size:28px;">' + tierIcon + '</span>' +
          '<div style="font-size:14px;font-weight:700;color:var(--cyan);margin-top:4px;">' + escHtml(agent.label) + '</div>' +
          '<div style="font-size:11px;color:var(--text2);">' + escHtml(agent.id) + '</div>' +
        '</div>' +
        '<div class="detail-row"><span class="label">Type</span><span class="value">' + agent.type + '</span></div>' +
        '<div class="detail-row"><span class="label">Department</span><span class="value">' + escHtml(agent.department) + '</span></div>' +
        '<div class="detail-row"><span class="label">Status</span><span class="value"><span class="status-chip ' + agent.status + '">' + agent.status + '</span></span></div>' +
        '<div class="detail-row"><span class="label">Cost</span><span class="value">$' + agent.costUsd.toFixed(4) + '</span></div>' +
        '<div class="detail-row"><span class="label">Workers</span><span class="value">' + children.length + '</span></div>' +
        (agent.currentTask
          ? '<h2 style="margin-top:12px;">Current Task</h2><div class="task-block">' + escHtml(agent.currentTask) + '</div>'
          : '') +
        (children.length > 0
          ? '<h2 style="margin-top:12px;">Children</h2><ul class="children-list">' +
            children.map(c => '<li>' + escHtml(c.label) + ' <span class="status-chip ' + c.status + '" style="font-size:10px;">' + c.status + '</span></li>').join('') +
            '</ul>'
          : '') +
        (recentEvents.length > 0
          ? '<h2 style="margin-top:12px;">Recent Activity</h2><div id="task-history">' +
            recentEvents.map(ev => '<div class="history-item">' + summarizeEventShort(ev) + '</div>').join('') +
            '</div>'
          : '');
    },

    clear() {
      document.getElementById('sidebar-empty').style.display = 'block';
      document.getElementById('sidebar-content').style.display = 'none';
    },
  };

  // ====================================================================
  // 5. EVENT LOG
  // ====================================================================
  const EventLog = {
    el: null,
    pauseEl: null,
    autoScroll: true,
    maxEntries: 500,

    init() {
      this.el = document.getElementById('log-entries');
      this.pauseEl = document.getElementById('log-pause');

      this.el.addEventListener('scroll', () => {
        const atBottom = this.el.scrollHeight - this.el.scrollTop - this.el.clientHeight < 30;
        this.autoScroll = atBottom;
        this.pauseEl.classList.toggle('visible', !atBottom);
      });
    },

    append(ev) {
      const row = document.createElement('div');
      row.className = 'log-entry';

      const now = new Date();
      const ts = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());

      let kindLabel = '';
      let kindClass = '';
      let message = '';

      switch (ev.kind) {
        case 'agent_spawned':
          kindLabel = 'SPAWN'; kindClass = 'spawn';
          message = '<b>' + escHtml(ev.label) + '</b> (' + ev.agentType + ') in ' + escHtml(ev.department);
          break;
        case 'agent_destroyed':
          kindLabel = 'DESTROY'; kindClass = 'destroy';
          message = escHtml(ev.agentId);
          break;
        case 'state_changed':
          kindLabel = 'STATE'; kindClass = 'state';
          message = escHtml(ev.agentId) + ': ' + ev.from + ' &#x2192; ' + ev.to;
          break;
        case 'task_assigned':
          kindLabel = 'TASK'; kindClass = 'task';
          message = escHtml(ev.agentId) + ': ' + escHtml(ev.taskSummary);
          break;
        case 'task_completed':
          kindLabel = ev.result === 'success' ? 'SUCCESS' : 'FAILED';
          kindClass = ev.result === 'success' ? 'done' : 'destroy';
          message = escHtml(ev.agentId);
          break;
        case 'message_sent':
          kindLabel = 'MSG'; kindClass = 'msg';
          message = escHtml(ev.fromId) + ' &#x2192; ' + escHtml(ev.toId) + ': ' + escHtml(ev.summary);
          break;
        case 'mention_created':
          kindLabel = '@MENTION'; kindClass = 'mention';
          message = escHtml(ev.summary) + ' [' + ev.urgency + ']';
          break;
        case 'mention_resolved':
          kindLabel = '@RESOLVED'; kindClass = 'resolved';
          message = escHtml(ev.mentionId) + ': ' + escHtml(ev.decision);
          break;
        case 'cost_update':
          kindLabel = 'COST'; kindClass = 'cost';
          message = 'Total: $' + ev.totalCost.toFixed(4);
          break;
        default:
          kindLabel = 'EVENT'; kindClass = '';
          message = JSON.stringify(ev);
      }

      row.innerHTML =
        '<span class="log-time">' + ts + '</span>' +
        '<span class="log-kind ' + kindClass + '">' + kindLabel + '</span>' +
        '<span class="log-msg">' + message + '</span>';

      this.el.appendChild(row);

      // Prune old entries
      while (this.el.children.length > this.maxEntries) {
        this.el.removeChild(this.el.firstChild);
      }

      if (this.autoScroll) {
        this.el.scrollTop = this.el.scrollHeight;
      }
    },
  };

  // ====================================================================
  // 6. STATUS BAR
  // ====================================================================
  const StatusBar = {
    update() {
      const agentCount = StateStore.agents.size;
      document.getElementById('badge-agents').textContent = agentCount + ' agent' + (agentCount !== 1 ? 's' : '');

      const meeting = StateStore.meeting;
      const meetingEl = document.getElementById('badge-meeting');
      if (meeting) {
        meetingEl.textContent = meeting.phase;
        meetingEl.className = 'badge amber';
      } else {
        meetingEl.textContent = 'No meeting';
        meetingEl.className = 'badge purple';
      }

      document.getElementById('badge-cost').textContent = '$' + StateStore.totalCost.toFixed(4);
    },
  };

  // ====================================================================
  // HELPERS
  // ====================================================================
  function escHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function summarizeEventShort(ev) {
    switch (ev.kind) {
      case 'agent_spawned': return 'Spawned: ' + escHtml(ev.label);
      case 'agent_destroyed': return 'Destroyed';
      case 'state_changed': return ev.from + ' &#x2192; ' + ev.to;
      case 'task_assigned': return 'Task: ' + escHtml(ev.taskSummary);
      case 'task_completed': return 'Completed: ' + ev.result;
      case 'message_sent': return 'Msg to ' + escHtml(ev.toId);
      case 'mention_created': return '@mention: ' + escHtml(ev.summary);
      case 'mention_resolved': return '@resolved: ' + escHtml(ev.decision);
      case 'cost_update': return 'Cost: $' + ev.totalCost.toFixed(4);
      default: return ev.kind;
    }
  }

  // ====================================================================
  // BOOT
  // ====================================================================
  document.addEventListener('DOMContentLoaded', () => {
    GraphRenderer.init();
    EventLog.init();
    StatusBar.update();
    ConnectionManager.connect();

    // Welcome log entry
    EventLog.append({ kind: 'state_changed', agentId: 'dashboard', from: 'offline', to: 'connected' });
  });

})();
</script>
</body>
</html>`
  );
}

// src/dashboard/events.ts
function serializeEvent(event) {
  return JSON.stringify(event);
}

// src/dashboard/state-bridge.ts
var StateBridge = class _StateBridge {
  agents = /* @__PURE__ */ new Map();
  edges = [];
  meeting = null;
  totalCost = 0;
  wss;
  /** Pending events accumulated during the debounce window. */
  pendingEvents = [];
  flushTimer = null;
  /** Debounce window in ms. */
  static DEBOUNCE_MS = 100;
  constructor(wss) {
    this.wss = wss;
    eventBus.on("agent_event", (event) => {
      this.handleEvent(event);
    });
  }
  // -----------------------------------------------------------------------
  // Public
  // -----------------------------------------------------------------------
  /**
   * Return a full snapshot of the current state — used when a new client connects.
   */
  getSnapshot() {
    return {
      type: "snapshot",
      agents: Array.from(this.agents.values()),
      edges: [...this.edges],
      meeting: this.meeting
    };
  }
  // -----------------------------------------------------------------------
  // Private — event handling
  // -----------------------------------------------------------------------
  handleEvent(event) {
    this.applyEvent(event);
    this.pendingEvents.push(event);
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, _StateBridge.DEBOUNCE_MS);
    }
  }
  flush() {
    this.flushTimer = null;
    if (this.pendingEvents.length === 0) return;
    const delta = {
      type: "delta",
      timestamp: Date.now(),
      events: [...this.pendingEvents]
    };
    this.pendingEvents = [];
    this.broadcast(delta);
  }
  // -----------------------------------------------------------------------
  // Private — state mutations
  // -----------------------------------------------------------------------
  applyEvent(event) {
    switch (event.kind) {
      case "agent_spawned": {
        const agent = {
          id: event.agentId,
          type: event.agentType,
          label: event.label,
          status: "idle",
          parentId: event.parentId,
          department: event.department,
          currentTask: null,
          costUsd: 0
        };
        this.agents.set(event.agentId, agent);
        if (event.parentId) {
          this.edges.push({
            id: `edge-${event.parentId}-${event.agentId}`,
            source: event.parentId,
            target: event.agentId,
            edgeType: "hierarchy",
            active: true,
            label: ""
          });
        }
        break;
      }
      case "agent_destroyed": {
        this.agents.delete(event.agentId);
        this.edges = this.edges.filter(
          (e) => e.source !== event.agentId && e.target !== event.agentId
        );
        break;
      }
      case "state_changed": {
        const a = this.agents.get(event.agentId);
        if (a) a.status = event.to;
        break;
      }
      case "task_assigned": {
        const a = this.agents.get(event.agentId);
        if (a) {
          a.currentTask = event.taskSummary;
          a.status = "working";
        }
        break;
      }
      case "task_completed": {
        const a = this.agents.get(event.agentId);
        if (a) {
          a.currentTask = null;
          a.status = event.result === "success" ? "completed" : "failed";
        }
        break;
      }
      case "message_sent": {
        const edgeId = `msg-${event.fromId}-${event.toId}-${Date.now()}`;
        this.edges.push({
          id: edgeId,
          source: event.fromId,
          target: event.toId,
          edgeType: "message",
          active: true,
          label: event.summary
        });
        setTimeout(() => {
          this.edges = this.edges.filter((e) => e.id !== edgeId);
        }, 5e3);
        break;
      }
      case "mention_created": {
        break;
      }
      case "mention_resolved": {
        break;
      }
      case "cost_update": {
        this.totalCost = event.totalCost;
        break;
      }
    }
  }
  // -----------------------------------------------------------------------
  // Private — broadcast
  // -----------------------------------------------------------------------
  broadcast(event) {
    const data = serializeEvent(event);
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  }
};

// src/dashboard/server.ts
function startDashboard() {
  const config = getConfig();
  const port = config.DASHBOARD_PORT;
  const httpServer = createHttpServer((req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getDashboardHTML());
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });
  const wss = new WebSocketServer({ server: httpServer });
  const bridge = new StateBridge(wss);
  wss.on("connection", (ws) => {
    const snapshot = bridge.getSnapshot();
    ws.send(JSON.stringify(snapshot));
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
      }
    });
  });
  httpServer.listen(port, "127.0.0.1", () => {
    logger.info(`Dashboard running at http://localhost:${port}`);
  });
  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      logger.warn(`Dashboard port ${port} in use, trying ${port + 1}`);
      httpServer.listen(port + 1, "127.0.0.1");
    } else {
      logger.error(`Dashboard server error: ${err.message}`);
    }
  });
  return {
    close: () => {
      wss.close();
      httpServer.close();
    }
  };
}

// src/index.ts
async function main() {
  ensureDataDirs();
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  startDashboard();
}
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
//# sourceMappingURL=index.js.map