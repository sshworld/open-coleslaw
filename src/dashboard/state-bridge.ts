/**
 * StateBridge — manages per-session meeting state and emits 'broadcast' events
 * for the dashboard server to relay to browser WebSocket clients.
 *
 * Scope is now a *meeting thread* (topic + agenda + comments + mvp checklist),
 * not the old agent-graph. Each session tracks its current in-progress meeting
 * plus a short history of past meetings.
 */

import { EventEmitter } from 'node:events';
import type {
  MeetingThread,
  MvpSummary,
  ThreadComment,
  AgentEvent,
  SessionSnapshot,
  MultiSessionSnapshot,
  SessionDelta,
} from '../types/dashboard-events.js';
import { logger } from '../utils/logger.js';

const MAX_PAST_MEETINGS = 5;
const EVENT_DEBOUNCE_MS = 100;

interface SessionState {
  projectName: string;
  displayName: string;
  projectPath: string;
  isActive: boolean;
  currentMeeting: MeetingThread | null;
  pastMeetings: MeetingThread[];
  mvps: MvpSummary[];
  totalCost: number;
}

export class StateBridge extends EventEmitter {
  private sessions = new Map<string, SessionState>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private pendingEvents = new Map<string, AgentEvent[]>();

  // ---- Session lifecycle --------------------------------------------------

  registerSession(info: {
    sessionId: string;
    projectPath: string;
    projectName: string;
  }): string {
    const displayName = this.getUniqueDisplayName(info.projectName);

    this.sessions.set(info.sessionId, {
      projectName: info.projectName,
      displayName,
      projectPath: info.projectPath,
      isActive: true,
      currentMeeting: null,
      pastMeetings: [],
      mvps: [],
      totalCost: 0,
    });

    logger.info(`Session registered: ${displayName} (${info.sessionId})`);

    this.emit(
      'broadcast',
      JSON.stringify({
        type: 'session-registered',
        sessionId: info.sessionId,
        displayName,
        projectPath: info.projectPath,
      }),
    );

    return displayName;
  }

  unregisterSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      logger.info(`Session deactivated: ${session.displayName}`);

      this.emit(
        'broadcast',
        JSON.stringify({
          type: 'session-unregistered',
          sessionId,
        }),
      );
    }
  }

  // ---- Event handling -----------------------------------------------------

  handleSessionEvent(sessionId: string, event: AgentEvent): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.applyEvent(session, event);

    if (!this.pendingEvents.has(sessionId)) {
      this.pendingEvents.set(sessionId, []);
    }
    this.pendingEvents.get(sessionId)!.push(event);

    if (!this.debounceTimers.has(sessionId)) {
      this.debounceTimers.set(
        sessionId,
        setTimeout(() => {
          this.flushEvents(sessionId);
          this.debounceTimers.delete(sessionId);
        }, EVENT_DEBOUNCE_MS),
      );
    }
  }

  // ---- Snapshot (initial connection) --------------------------------------

  getSnapshot(): MultiSessionSnapshot {
    return {
      type: 'multi-snapshot',
      sessions: Array.from(this.sessions.entries()).map(
        ([sessionId, s]): SessionSnapshot => ({
          sessionId,
          displayName: s.displayName,
          projectPath: s.projectPath,
          isActive: s.isActive,
          currentMeeting: s.currentMeeting,
          pastMeetings: [...s.pastMeetings],
          mvps: [...s.mvps],
          totalCost: s.totalCost,
        }),
      ),
    };
  }

  // ---- Private helpers ----------------------------------------------------

  private getUniqueDisplayName(projectName: string): string {
    const existing = Array.from(this.sessions.values()).map(
      (s) => s.displayName,
    );
    if (!existing.includes(projectName)) return projectName;
    let i = 1;
    while (existing.includes(`${projectName} (${i})`)) i++;
    return `${projectName} (${i})`;
  }

  private applyEvent(session: SessionState, event: AgentEvent): void {
    switch (event.kind) {
      case 'meeting_started': {
        if (session.currentMeeting) {
          session.pastMeetings.unshift(session.currentMeeting);
          if (session.pastMeetings.length > MAX_PAST_MEETINGS) {
            session.pastMeetings.pop();
          }
        }
        session.currentMeeting = {
          meetingId: event.meetingId,
          meetingType: event.meetingType,
          topic: event.topic,
          agenda: [...event.agenda],
          participants: [...event.participants],
          status: 'in-progress',
          phase: 'opening',
          comments: [],
          mvps: [],
          decisions: [],
          actionItems: [],
          startedAt: Date.now(),
          completedAt: null,
        };
        break;
      }
      case 'transcript_added': {
        if (session.currentMeeting?.meetingId === event.meetingId) {
          session.currentMeeting.comments.push(event.comment);
        }
        break;
      }
      case 'round_advanced': {
        if (session.currentMeeting?.meetingId === event.meetingId) {
          session.currentMeeting.phase = 'discussion';
        }
        break;
      }
      case 'consensus_checked': {
        if (session.currentMeeting?.meetingId === event.meetingId) {
          session.currentMeeting.status = event.allAgreed
            ? 'in-progress' // about to synthesize
            : 'awaiting-consensus';
        }
        break;
      }
      case 'minutes_finalized': {
        if (session.currentMeeting?.meetingId === event.meetingId) {
          session.currentMeeting.decisions = [...event.decisions];
          session.currentMeeting.actionItems = [...event.actionItems];
          session.currentMeeting.status = 'completed';
          session.currentMeeting.phase = 'minutes-generation';
          session.currentMeeting.completedAt = Date.now();
        }
        break;
      }
      case 'user_comment_added': {
        if (session.currentMeeting?.meetingId === event.meetingId) {
          const nextId = session.currentMeeting.comments.length + 1;
          const userComment: ThreadComment = {
            id: nextId,
            speakerRole: 'user',
            agendaItemIndex: -3,
            roundNumber: 0,
            content: event.content,
            stance: 'speaking',
            createdAt: Date.now(),
          };
          session.currentMeeting.comments.push(userComment);
        }
        break;
      }
      case 'mvp_progress': {
        session.mvps = [...event.mvps];
        if (session.currentMeeting) {
          session.currentMeeting.mvps = [...event.mvps];
        }
        break;
      }
      case 'cost_update': {
        session.totalCost = event.totalCost;
        break;
      }
      case 'mention_created':
      case 'mention_resolved':
        // Not surfaced on the thread UI; mention list is a separate view.
        break;
    }
  }

  private flushEvents(sessionId: string): void {
    const events = this.pendingEvents.get(sessionId);
    const session = this.sessions.get(sessionId);
    if (!events || !session || events.length === 0) return;

    const delta: SessionDelta = {
      type: 'session-delta',
      sessionId,
      displayName: session.displayName,
      timestamp: Date.now(),
      events: [...events],
    };

    this.emit('broadcast', JSON.stringify(delta));
    this.pendingEvents.set(sessionId, []);
  }
}
