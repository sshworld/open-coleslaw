/**
 * StateBridge — manages per-PROJECT meeting state and emits 'broadcast' events
 * for the dashboard server to relay to browser WebSocket clients.
 *
 * Keyed by **projectPath** (not sessionId) so that reopening the same project
 * in a new terminal does not create a duplicate "project (1)" tab. Multiple
 * terminal sessions for the same project are merged into one view; the tab
 * goes inactive only when the last session for that project disconnects.
 *
 * A meeting thread (topic + agenda + comments + mvp checklist) is the unit
 * displayed per tab.
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

const MAX_PAST_MEETINGS = 20; // keep a longer history now that the UI supports browsing
const EVENT_DEBOUNCE_MS = 100;

interface ProjectState {
  projectPath: string;
  projectName: string;
  displayName: string;
  activeSessionIds: Set<string>;
  currentMeeting: MeetingThread | null;
  pastMeetings: MeetingThread[];
  mvps: MvpSummary[];
  totalCost: number;
}

export class StateBridge extends EventEmitter {
  // projectPath → ProjectState (single row per project, merged across terminals)
  private projects = new Map<string, ProjectState>();
  // terminal sessionId → projectPath (for event routing)
  private sessionToProject = new Map<string, string>();

  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private pendingEvents = new Map<string, AgentEvent[]>();

  // ---- Session lifecycle --------------------------------------------------

  registerSession(info: {
    sessionId: string;
    projectPath: string;
    projectName: string;
  }): string {
    const existing = this.projects.get(info.projectPath);
    if (existing) {
      // Same project, new terminal: just reactivate and record the sessionId.
      existing.activeSessionIds.add(info.sessionId);
      this.sessionToProject.set(info.sessionId, info.projectPath);
      logger.info(`Session reattached to existing project: ${existing.displayName} (${info.sessionId})`);
      this.emit(
        'broadcast',
        JSON.stringify({
          type: 'session-registered',
          sessionId: info.projectPath, // wire sessionId = projectPath so UI tab is stable
          displayName: existing.displayName,
          projectPath: info.projectPath,
        }),
      );
      return existing.displayName;
    }

    const displayName = info.projectName;
    const state: ProjectState = {
      projectPath: info.projectPath,
      projectName: info.projectName,
      displayName,
      activeSessionIds: new Set([info.sessionId]),
      currentMeeting: null,
      pastMeetings: [],
      mvps: [],
      totalCost: 0,
    };
    this.projects.set(info.projectPath, state);
    this.sessionToProject.set(info.sessionId, info.projectPath);

    logger.info(`Project registered: ${displayName} (${info.projectPath})`);

    this.emit(
      'broadcast',
      JSON.stringify({
        type: 'session-registered',
        sessionId: info.projectPath, // projectPath is the stable wire-side sessionId
        displayName,
        projectPath: info.projectPath,
      }),
    );

    return displayName;
  }

  unregisterSession(sessionId: string): void {
    const projectPath = this.sessionToProject.get(sessionId);
    if (!projectPath) return;
    this.sessionToProject.delete(sessionId);

    const project = this.projects.get(projectPath);
    if (!project) return;
    project.activeSessionIds.delete(sessionId);

    if (project.activeSessionIds.size === 0) {
      // Last terminal for this project closed — mark the tab inactive but keep history.
      logger.info(`Project deactivated: ${project.displayName}`);
      this.emit(
        'broadcast',
        JSON.stringify({
          type: 'session-unregistered',
          sessionId: projectPath,
        }),
      );
    }
  }

  // ---- Event handling -----------------------------------------------------

  handleSessionEvent(sessionId: string, event: AgentEvent): void {
    const projectPath = this.sessionToProject.get(sessionId) ?? sessionId; // fallback: sessionId might already be projectPath (owner self-events)
    const project = this.projects.get(projectPath);
    if (!project) return;

    this.applyEvent(project, event);

    if (!this.pendingEvents.has(projectPath)) {
      this.pendingEvents.set(projectPath, []);
    }
    this.pendingEvents.get(projectPath)!.push(event);

    if (!this.debounceTimers.has(projectPath)) {
      this.debounceTimers.set(
        projectPath,
        setTimeout(() => {
          this.flushEvents(projectPath);
          this.debounceTimers.delete(projectPath);
        }, EVENT_DEBOUNCE_MS),
      );
    }
  }

  // ---- Snapshot (initial connection) --------------------------------------

  getSnapshot(): MultiSessionSnapshot {
    return {
      type: 'multi-snapshot',
      sessions: Array.from(this.projects.values()).map(
        (s): SessionSnapshot => ({
          sessionId: s.projectPath, // stable wire-side id
          displayName: s.displayName,
          projectPath: s.projectPath,
          isActive: s.activeSessionIds.size > 0,
          currentMeeting: s.currentMeeting,
          pastMeetings: [...s.pastMeetings],
          mvps: [...s.mvps],
          totalCost: s.totalCost,
        }),
      ),
    };
  }

  // ---- Private helpers ----------------------------------------------------

  private applyEvent(project: ProjectState, event: AgentEvent): void {
    switch (event.kind) {
      case 'meeting_started': {
        if (project.currentMeeting) {
          project.pastMeetings.unshift(project.currentMeeting);
          if (project.pastMeetings.length > MAX_PAST_MEETINGS) {
            project.pastMeetings.pop();
          }
        }
        project.currentMeeting = {
          meetingId: event.meetingId,
          meetingType: event.meetingType,
          topic: event.topic,
          agenda: [...event.agenda],
          participants: [...event.participants],
          status: 'in-progress',
          phase: 'opening',
          comments: [],
          mvps: [...project.mvps],
          decisions: [],
          actionItems: [],
          startedAt: Date.now(),
          completedAt: null,
        };
        break;
      }
      case 'transcript_added': {
        if (project.currentMeeting?.meetingId === event.meetingId) {
          project.currentMeeting.comments.push(event.comment);
        } else {
          // Transcript for a different meeting — try to find it in past meetings.
          const past = project.pastMeetings.find((m) => m.meetingId === event.meetingId);
          if (past) past.comments.push(event.comment);
        }
        break;
      }
      case 'round_advanced': {
        if (project.currentMeeting?.meetingId === event.meetingId) {
          project.currentMeeting.phase = 'discussion';
        }
        break;
      }
      case 'consensus_checked': {
        if (project.currentMeeting?.meetingId === event.meetingId) {
          project.currentMeeting.status = event.allAgreed
            ? 'in-progress'
            : 'awaiting-consensus';
        }
        break;
      }
      case 'minutes_finalized': {
        const target =
          project.currentMeeting?.meetingId === event.meetingId
            ? project.currentMeeting
            : project.pastMeetings.find((m) => m.meetingId === event.meetingId);
        if (target) {
          target.decisions = [...event.decisions];
          target.actionItems = [...event.actionItems];
          target.status = 'completed';
          target.phase = 'minutes-generation';
          target.completedAt = Date.now();
        }
        break;
      }
      case 'user_comment_added': {
        if (project.currentMeeting?.meetingId === event.meetingId) {
          const nextId = project.currentMeeting.comments.length + 1;
          const userComment: ThreadComment = {
            id: nextId,
            speakerRole: 'user',
            agendaItemIndex: -3,
            roundNumber: 0,
            content: event.content,
            stance: 'speaking',
            createdAt: Date.now(),
          };
          project.currentMeeting.comments.push(userComment);
        }
        break;
      }
      case 'mvp_progress': {
        project.mvps = [...event.mvps];
        if (project.currentMeeting) {
          project.currentMeeting.mvps = [...event.mvps];
        }
        break;
      }
      case 'cost_update': {
        project.totalCost = event.totalCost;
        break;
      }
      case 'mention_created':
      case 'mention_resolved':
        // Not surfaced on the thread UI; mention list is a separate view.
        break;
    }
  }

  private flushEvents(projectPath: string): void {
    const events = this.pendingEvents.get(projectPath);
    const project = this.projects.get(projectPath);
    if (!events || !project || events.length === 0) return;

    const delta: SessionDelta = {
      type: 'session-delta',
      sessionId: projectPath,
      displayName: project.displayName,
      timestamp: Date.now(),
      events: [...events],
    };

    this.emit('broadcast', JSON.stringify(delta));
    this.pendingEvents.set(projectPath, []);
  }
}
