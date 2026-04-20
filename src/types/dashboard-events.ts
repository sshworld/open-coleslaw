import type { MeetingPhase } from './meeting.js';

// ---------------------------------------------------------------------------
// Meeting thread model — replaces the old agent-graph model
// ---------------------------------------------------------------------------

export type MeetingType = 'kickoff' | 'design' | 'verify-retry';

export type MeetingThreadStatus =
  | 'in-progress'
  | 'awaiting-consensus'
  | 'completed'
  | 'escalated';

export type Stance = 'agree' | 'disagree' | 'speaking';

export interface ThreadComment {
  id: number;
  speakerRole: string; // 'planner' | 'architect' | ... | 'user'
  agendaItemIndex: number;
  roundNumber: number;
  content: string;
  stance: Stance;
  createdAt: number;
}

export interface MvpSummary {
  id: string;
  title: string;
  goal: string;
  status: 'pending' | 'in-progress' | 'done' | 'blocked';
  orderIndex: number;
}

export interface MeetingThread {
  meetingId: string;
  meetingType: MeetingType;
  topic: string;
  agenda: string[];
  participants: string[];
  status: MeetingThreadStatus;
  phase: MeetingPhase;
  comments: ThreadComment[];
  mvps: MvpSummary[]; // populated on kickoff meetings or carried alongside
  decisions: string[]; // populated after synthesis
  actionItems: string[]; // populated after synthesis
  startedAt: number;
  completedAt: number | null;
}

// ---------------------------------------------------------------------------
// Events (server → browser)
// ---------------------------------------------------------------------------

export type AgentEvent =
  | {
      kind: 'meeting_started';
      meetingId: string;
      meetingType: MeetingType;
      topic: string;
      agenda: string[];
      participants: string[];
    }
  | {
      kind: 'transcript_added';
      meetingId: string;
      comment: ThreadComment;
    }
  | {
      kind: 'round_advanced';
      meetingId: string;
      roundNumber: number;
      agendaItemIndex: number;
    }
  | {
      kind: 'consensus_checked';
      meetingId: string;
      allAgreed: boolean;
      stances: Array<{ role: string; stance: Stance; reason?: string }>;
    }
  | {
      kind: 'minutes_finalized';
      meetingId: string;
      decisions: string[];
      actionItems: string[];
    }
  | {
      kind: 'user_comment_added';
      meetingId: string;
      content: string;
      source: 'terminal' | 'browser';
    }
  | {
      kind: 'mvp_progress';
      mvps: MvpSummary[];
    }
  | {
      kind: 'mention_created';
      mentionId: string;
      summary: string;
      urgency: 'blocking' | 'advisory';
    }
  | {
      kind: 'mention_resolved';
      mentionId: string;
      decision: string;
    }
  | { kind: 'cost_update'; totalCost: number }
  | {
      kind: 'plan_state';
      /**
       * `entered`          — main session just called EnterPlanMode.
       * `clarify-asked`    — planner returned NEEDS_CLARIFICATION and we're
       *                      about to surface the questions via AskUserQuestion.
       * `clarify-answered` — user's answers came back; decompose begins.
       * `plan-presented`   — plan passed to ExitPlanMode, awaiting user.
       * `resolved`         — plan was accepted (auto / manual) or rejected.
       */
      phase:
        | 'entered'
        | 'clarify-asked'
        | 'clarify-answered'
        | 'plan-presented'
        | 'resolved';
      /** Which cycle the plan mode wraps: kickoff, per-MVP design, or verify-retry. */
      cycle?: 'kickoff' | 'design' | 'verify-retry';
      /** The clarify questions (populated on clarify-asked). */
      questions?: Array<{ id: string; question: string; options: string[] }>;
      /** The user's picks (populated on clarify-answered). */
      answers?: Array<{ id: string; picked: string }>;
      /** The plan text sent to ExitPlanMode (populated on plan-presented). */
      plan?: string;
      /** How the user resolved the plan. Populated on `resolved`. */
      outcome?: 'auto-accept' | 'manual-approve' | 'rejected';
      /** User's rejection feedback (populated when outcome === 'rejected'). */
      feedback?: string;
    };

// ---------------------------------------------------------------------------
// Plan-mode state snapshot (for the dashboard sidebar panel)
// ---------------------------------------------------------------------------

export interface PlanState {
  active: boolean;
  cycle: 'kickoff' | 'design' | 'verify-retry' | null;
  phase:
    | 'entered'
    | 'clarify-asked'
    | 'clarify-answered'
    | 'plan-presented'
    | 'resolved'
    | null;
  questions: Array<{ id: string; question: string; options: string[] }> | null;
  answers: Array<{ id: string; picked: string }> | null;
  plan: string | null;
  outcome: 'auto-accept' | 'manual-approve' | 'rejected' | null;
  feedback: string | null;
  updatedAt: number | null;
}

// ---------------------------------------------------------------------------
// Multi-session types (dashboard owner + remote MCP clients)
// ---------------------------------------------------------------------------

export interface ProjectSession {
  sessionId: string;
  projectPath: string;
  projectName: string;
  displayName: string;
  isActive: boolean;
}

export interface RegisterMessage {
  type: 'register';
  sessionId: string;
  projectPath: string;
  projectName: string;
}

export interface SessionEventMessage {
  type: 'session-event';
  sessionId: string;
  event: AgentEvent;
}

export interface UnregisterMessage {
  type: 'unregister';
  sessionId: string;
}

export interface UserCommentMessage {
  type: 'user-comment';
  sessionId: string;
  meetingId: string;
  content: string;
}

export type ServerMessage =
  | RegisterMessage
  | SessionEventMessage
  | UnregisterMessage
  | UserCommentMessage;

export interface SessionSnapshot {
  sessionId: string;
  displayName: string;
  projectPath: string;
  isActive: boolean;
  currentMeeting: MeetingThread | null;
  pastMeetings: MeetingThread[]; // last N finished threads
  mvps: MvpSummary[];
  totalCost: number;
  planState: PlanState;
}

export interface MultiSessionSnapshot {
  type: 'multi-snapshot';
  sessions: SessionSnapshot[];
}

export interface SessionDelta {
  type: 'session-delta';
  sessionId: string;
  displayName: string;
  timestamp: number;
  events: AgentEvent[];
}

export interface SessionRegistered {
  type: 'session-registered';
  sessionId: string;
  displayName: string;
  projectPath: string;
}

export interface SessionUnregistered {
  type: 'session-unregistered';
  sessionId: string;
}
