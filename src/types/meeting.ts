export type MeetingStatus =
  | 'pending'
  | 'convening'
  | 'opening'
  | 'discussion'
  | 'synthesis'
  | 'minutes-generation'
  | 'completed'
  | 'compacted'
  | 'executing'
  | 'aggregation'
  | 'reported'
  | 'waiting-for-user'
  | 'cancelled'
  | 'failed';

export type MeetingPhase =
  | 'orchestrator-phase'
  | 'convening'
  | 'opening'
  | 'discussion'
  | 'research-break'
  | 'synthesis'
  | 'minutes-generation';

export interface Meeting {
  id: string;
  topic: string;
  agenda: string[];
  participantIds: string[];
  status: MeetingStatus;
  phase: MeetingPhase;
  startedAt: number | null;
  completedAt: number | null;
  initiatedBy: string;
  previousMeetingId: string | null;
}

export interface MeetingConfig {
  maxRoundsPerItem: number;
  convergenceThreshold: number;
  /**
   * Optional. When absent, the meeting inherits the model of the user's
   * Claude Code session. We no longer hard-code model names.
   */
  model?: string;
}

export const DEFAULT_MEETING_CONFIG: MeetingConfig = {
  maxRoundsPerItem: 10,
  convergenceThreshold: 0.8,
};

export interface TranscriptEntry {
  id: number;
  meetingId: string;
  speakerId: string;
  speakerRole: string;
  agendaItemIndex: number;
  roundNumber: number;
  content: string;
  tokenCount: number;
  createdAt: number;
}
