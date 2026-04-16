import type {
  TranscriptEntry,
  MeetingStatus,
  MeetingPhase,
  ActionItem,
} from '../types/index.js';
import {
  getMeeting,
  updateMeeting,
  createMinutes,
  getMinutesByMeeting,
} from '../storage/index.js';
import { getDb } from '../storage/db.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Transcript helpers (direct DB access since there is no transcript store)
// ---------------------------------------------------------------------------

function insertTranscriptEntry(
  meetingId: string,
  speakerId: string,
  speakerRole: string,
  agendaItemIndex: number,
  roundNumber: number,
  content: string,
): TranscriptEntry {
  const db = getDb();
  const now = Date.now();
  const tokenCount = Math.ceil(content.length / 4); // rough approximation

  const result = db
    .prepare(
      `INSERT INTO transcript_entries
         (meeting_id, speaker_id, speaker_role, agenda_item_index, round_number, content, token_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(meetingId, speakerId, speakerRole, agendaItemIndex, roundNumber, content, tokenCount, now);

  return {
    id: Number(result.lastInsertRowid),
    meetingId,
    speakerId,
    speakerRole,
    agendaItemIndex,
    roundNumber,
    content,
    tokenCount,
    createdAt: now,
  };
}

function getTranscript(meetingId: string): TranscriptEntry[] {
  const db = getDb();
  interface TranscriptRow {
    id: number;
    meeting_id: string;
    speaker_id: string;
    speaker_role: string;
    agenda_item_index: number;
    round_number: number;
    content: string;
    token_count: number;
    created_at: number;
  }
  const rows = db
    .prepare('SELECT * FROM transcript_entries WHERE meeting_id = ? ORDER BY created_at ASC')
    .all(meetingId) as TranscriptRow[];

  return rows.map((r) => ({
    id: r.id,
    meetingId: r.meeting_id,
    speakerId: r.speaker_id,
    speakerRole: r.speaker_role,
    agendaItemIndex: r.agenda_item_index,
    roundNumber: r.round_number,
    content: r.content,
    tokenCount: r.token_count,
    createdAt: r.created_at,
  }));
}

// ---------------------------------------------------------------------------
// MeetingRunner — data-only utility (no agent invocation)
//
// Stores transcript entries and generates minutes from stored transcripts.
// Actual agent dispatch is handled by Claude Code's Agent tool, orchestrated
// by skill/agent markdown files.
// ---------------------------------------------------------------------------

export class MeetingRunner {
  private readonly meetingId: string;

  constructor(meetingId: string) {
    this.meetingId = meetingId;
  }

  // ---- Add transcript entry (called by MCP tool add-transcript) -----------

  /**
   * Add a transcript entry for this meeting.
   * Returns the created TranscriptEntry.
   */
  addTranscript(
    speakerRole: string,
    agendaItemIndex: number,
    roundNumber: number,
    content: string,
  ): TranscriptEntry {
    const meeting = getMeeting(this.meetingId);
    if (!meeting) {
      throw new Error(`Meeting not found: ${this.meetingId}`);
    }

    // Use speakerRole as speakerId since we no longer manage agent nodes here
    const entry = insertTranscriptEntry(
      this.meetingId,
      speakerRole,
      speakerRole,
      agendaItemIndex,
      roundNumber,
      content,
    );

    logger.debug(`Transcript added: ${speakerRole} (item ${agendaItemIndex}, round ${roundNumber})`, {
      meetingId: this.meetingId,
    });

    return entry;
  }

  // ---- Generate minutes from all transcripts ------------------------------

  /**
   * Generate meeting minutes by formatting all stored transcript entries.
   * Returns the minutesId of the created minutes record.
   */
  async generateMinutes(): Promise<string> {
    const meeting = getMeeting(this.meetingId);
    if (!meeting) {
      throw new Error(`Meeting not found: ${this.meetingId}`);
    }

    // Update phase
    updateMeeting(this.meetingId, {
      phase: 'minutes-generation' as MeetingPhase,
      status: 'minutes-generation' as MeetingStatus,
    });

    const transcript = getTranscript(this.meetingId);

    // --- Build the minutes content ---

    const sections: string[] = [];

    // Collect unique speaker roles from transcript
    const speakerRoles = [...new Set(transcript.map((e) => e.speakerRole))];

    sections.push(`# Meeting Minutes`);
    sections.push(`## Topic: ${meeting.topic}`);
    sections.push(`## Date: ${new Date().toISOString()}`);
    sections.push(`## Participants: ${speakerRoles.join(', ')}`);
    sections.push('');

    // Agenda
    sections.push(`## Agenda`);
    meeting.agenda.forEach((item, i) => {
      sections.push(`${i + 1}. ${item}`);
    });
    sections.push('');

    // Opening statements
    const openingEntries = transcript.filter((e) => e.agendaItemIndex === -1);
    if (openingEntries.length > 0) {
      sections.push(`## Opening Statements`);
      for (const entry of openingEntries) {
        sections.push(`### ${entry.speakerRole}`);
        sections.push(entry.content);
        sections.push('');
      }
    }

    // Discussion per agenda item
    for (let i = 0; i < meeting.agenda.length; i++) {
      const itemEntries = transcript.filter((e) => e.agendaItemIndex === i);
      if (itemEntries.length > 0) {
        sections.push(`## Discussion: ${meeting.agenda[i]}`);
        for (const entry of itemEntries) {
          sections.push(`**${entry.speakerRole}** (round ${entry.roundNumber}):`);
          sections.push(entry.content);
          sections.push('');
        }
      }
    }

    // Synthesis
    const synthesisEntries = transcript.filter((e) => e.agendaItemIndex === -2);
    if (synthesisEntries.length > 0) {
      sections.push(`## Final Positions`);
      for (const entry of synthesisEntries) {
        sections.push(`### ${entry.speakerRole}`);
        sections.push(entry.content);
        sections.push('');
      }
    }

    const content = sections.join('\n');

    // --- Extract action items from synthesis entries ---

    const actionItems: ActionItem[] = speakerRoles.map((role, idx) => ({
      id: `action-${this.meetingId}-${idx}`,
      title: `${role} deliverables`,
      description: `Action items committed by ${role} during synthesis phase`,
      assignedDepartment: 'engineering', // default; will be refined by compactor
      assignedRole: role,
      priority: 'medium' as const,
      dependencies: [],
      acceptanceCriteria: ['Deliverables completed as stated in final position'],
    }));

    const minutesRecord = createMinutes({
      meetingId: this.meetingId,
      format: 'summary',
      content,
      actionItems,
    });

    // Mark meeting as completed
    updateMeeting(this.meetingId, {
      status: 'completed' as MeetingStatus,
      completedAt: Date.now(),
    });

    logger.info('Minutes generated', { meetingId: this.meetingId });

    return minutesRecord.id;
  }

  // ---- Completion status --------------------------------------------------

  /**
   * Check whether the meeting has been completed (minutes generated).
   */
  isComplete(): boolean {
    const meeting = getMeeting(this.meetingId);
    if (!meeting) return false;
    return ['completed', 'compacted', 'reported'].includes(meeting.status);
  }

  // ---- Transcript access --------------------------------------------------

  /**
   * Get all transcript entries for this meeting.
   */
  getTranscript(): TranscriptEntry[] {
    return getTranscript(this.meetingId);
  }
}
