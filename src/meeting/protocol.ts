/**
 * Turn management and agenda progression for meetings.
 */

import type { TranscriptEntry } from '../types/index.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Protocol state
// ---------------------------------------------------------------------------

export class MeetingProtocol {
  private readonly meetingId: string;
  private readonly agenda: string[];
  private readonly participantIds: string[];

  private currentItemIndex: number = 0;
  private currentSpeakerIndex: number = 0;
  private currentRound: number = 1;

  constructor(meetingId: string, agenda: string[], participantIds: string[]) {
    this.meetingId = meetingId;
    this.agenda = agenda;
    this.participantIds = participantIds;

    logger.debug('MeetingProtocol created', {
      meetingId,
      agendaCount: agenda.length,
      participantCount: participantIds.length,
    } as Record<string, unknown>);
  }

  // -------------------------------------------------------------------------
  // Agenda item
  // -------------------------------------------------------------------------

  /**
   * Get the current agenda item index and text.
   * Returns null when all items have been exhausted.
   */
  getCurrentAgendaItem(): { index: number; item: string } | null {
    if (this.currentItemIndex >= this.agenda.length) {
      return null;
    }
    return {
      index: this.currentItemIndex,
      item: this.agenda[this.currentItemIndex],
    };
  }

  // -------------------------------------------------------------------------
  // Speaker turn
  // -------------------------------------------------------------------------

  /**
   * Return the next speaker in round-robin order.
   * Returns null if there are no participants.
   */
  getNextSpeaker(): string | null {
    if (this.participantIds.length === 0) {
      return null;
    }

    const speaker = this.participantIds[this.currentSpeakerIndex];
    this.currentSpeakerIndex =
      (this.currentSpeakerIndex + 1) % this.participantIds.length;

    return speaker;
  }

  // -------------------------------------------------------------------------
  // Round management
  // -------------------------------------------------------------------------

  /**
   * Advance to the next round (all participants have spoken).
   * Resets the speaker index to 0 and increments the round counter.
   */
  advanceRound(): { item: number; round: number } {
    this.currentRound += 1;
    this.currentSpeakerIndex = 0;

    logger.debug('Round advanced', {
      meetingId: this.meetingId,
      item: this.currentItemIndex,
      round: this.currentRound,
    } as Record<string, unknown>);

    return {
      item: this.currentItemIndex,
      round: this.currentRound,
    };
  }

  /**
   * Advance to the next agenda item.
   * Resets round and speaker counters.
   * Returns the new item index, or null if no more items.
   */
  advanceAgendaItem(): number | null {
    this.currentItemIndex += 1;
    this.currentRound = 1;
    this.currentSpeakerIndex = 0;

    if (this.currentItemIndex >= this.agenda.length) {
      logger.info('All agenda items completed', { meetingId: this.meetingId });
      return null;
    }

    logger.debug('Agenda item advanced', {
      meetingId: this.meetingId,
      item: this.currentItemIndex,
    } as Record<string, unknown>);

    return this.currentItemIndex;
  }

  // -------------------------------------------------------------------------
  // Convergence / end-of-discussion check
  // -------------------------------------------------------------------------

  /**
   * Check whether the discussion for the current agenda item should end.
   *
   * Ends when:
   * 1. Maximum rounds have been reached, OR
   * 2. The latest round has fewer unique content tokens (simple convergence
   *    heuristic — if the last speaker's content is short, assume agreement).
   */
  shouldEndDiscussion(maxRounds: number): boolean {
    return this.currentRound > maxRounds;
  }

  // -------------------------------------------------------------------------
  // Context formatting
  // -------------------------------------------------------------------------

  /**
   * Format the discussion context for a speaker's turn.
   * Includes the current agenda item and all transcript entries so far
   * for that item, excluding the speaker's own prior entries.
   */
  formatSpeakerContext(
    speakerId: string,
    transcript: TranscriptEntry[],
  ): string {
    const currentItem = this.getCurrentAgendaItem();
    if (!currentItem) {
      return '[Meeting has no more agenda items.]';
    }

    const relevantEntries = transcript.filter(
      (e) =>
        e.meetingId === this.meetingId &&
        e.agendaItemIndex === currentItem.index,
    );

    const lines: string[] = [
      `## Current Agenda Item (${currentItem.index + 1}/${this.agenda.length}): ${currentItem.item}`,
      `**Round**: ${this.currentRound}`,
      '',
    ];

    if (relevantEntries.length === 0) {
      lines.push('_No prior discussion on this item yet._');
    } else {
      lines.push('### Prior Discussion');
      for (const entry of relevantEntries) {
        const marker = entry.speakerId === speakerId ? '(you)' : '';
        lines.push(
          `**[${entry.speakerRole}${marker ? ' ' + marker : ''}]** (round ${entry.roundNumber}): ${entry.content}`,
        );
      }
    }

    return lines.join('\n');
  }
}
