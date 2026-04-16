/**
 * Detects @mention points (user-decision-needed markers) in meeting responses,
 * and detects sustained disagreement between participants.
 */

import { v4 as uuidv4 } from 'uuid';
import type { TranscriptEntry, MentionRecord, MentionOption } from '../types/index.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MENTION_MARKER = '@USER_DECISION_NEEDED:';

/**
 * Contradicting keyword pairs — if two different speakers each use one side,
 * that is a signal of disagreement.
 */
const CONTRADICTION_PAIRS: [string[], string[]][] = [
  [['agree', '동의', 'yes', 'approve', 'support'], ['disagree', '반대', 'no', 'reject', 'oppose']],
  [['simple', 'easy', 'lightweight'], ['complex', 'difficult', 'heavyweight']],
  [['monolith', 'single'], ['microservice', 'distributed', 'separate']],
  [['sql', 'relational'], ['nosql', 'document', 'non-relational']],
];

// ---------------------------------------------------------------------------
// MentionDetector
// ---------------------------------------------------------------------------

export class MentionDetector {
  /**
   * Check a leader's response for @USER_DECISION_NEEDED: markers.
   *
   * Expected format in response:
   * ```
   * @USER_DECISION_NEEDED: <summary text>
   * A) <option A description>
   * B) <option B description>
   * C) <option C description>
   * ```
   *
   * Returns a MentionRecord if the marker is found, otherwise null.
   */
  detectMention(
    response: string,
    meetingId: string,
    agendaItem: string,
  ): MentionRecord | null {
    const markerIndex = response.indexOf(MENTION_MARKER);
    if (markerIndex === -1) {
      return null;
    }

    logger.info('Mention detected in response', { meetingId });

    // Extract everything after the marker
    const afterMarker = response.slice(markerIndex + MENTION_MARKER.length);
    const lines = afterMarker.split('\n').map((l) => l.trim()).filter(Boolean);

    // First line is the summary
    const summary = lines[0] ?? 'Decision needed';

    // Parse options: look for A), B), C) etc.
    const options: MentionOption[] = [];
    const optionRegex = /^([A-Z])\)\s*(.+)$/;

    for (const line of lines.slice(1)) {
      const match = optionRegex.exec(line);
      if (match) {
        options.push({
          label: match[1],
          description: match[2],
          supportedBy: [],
        });
      } else {
        // Stop parsing options when we hit a non-option line
        break;
      }
    }

    // If no structured options found, create a simple yes/no
    if (options.length === 0) {
      options.push(
        { label: 'A', description: 'Proceed as suggested', supportedBy: [] },
        { label: 'B', description: 'Defer or reject', supportedBy: [] },
      );
    }

    const record: MentionRecord = {
      id: uuidv4(),
      meetingId,
      agendaItem,
      summary,
      options,
      urgency: 'advisory',
      status: 'pending',
      userDecision: null,
      userReasoning: null,
      createdAt: Date.now(),
      resolvedAt: null,
    };

    return record;
  }

  /**
   * Detect if there has been sustained disagreement on an agenda item.
   *
   * Heuristic:
   * - The agenda item has gone beyond maxRounds rounds
   * - The last entries from different speakers contain contradicting keywords
   */
  detectDisagreement(
    transcript: TranscriptEntry[],
    agendaItemIndex: number,
    maxRounds: number,
  ): boolean {
    const itemEntries = transcript.filter(
      (e) => e.agendaItemIndex === agendaItemIndex,
    );

    if (itemEntries.length === 0) {
      return false;
    }

    // Check if we've exceeded maxRounds
    const maxRound = Math.max(...itemEntries.map((e) => e.roundNumber));
    if (maxRound < maxRounds) {
      return false;
    }

    // Get the last entry per speaker (from the latest round)
    const latestRoundEntries = itemEntries.filter(
      (e) => e.roundNumber === maxRound,
    );

    if (latestRoundEntries.length < 2) {
      return false;
    }

    // Check for contradicting keywords between different speakers
    for (let i = 0; i < latestRoundEntries.length; i++) {
      for (let j = i + 1; j < latestRoundEntries.length; j++) {
        if (latestRoundEntries[i].speakerId === latestRoundEntries[j].speakerId) {
          continue;
        }

        const textA = latestRoundEntries[i].content.toLowerCase();
        const textB = latestRoundEntries[j].content.toLowerCase();

        for (const [sideA, sideB] of CONTRADICTION_PAIRS) {
          const aHasSideA = sideA.some((kw) => textA.includes(kw));
          const aHasSideB = sideB.some((kw) => textA.includes(kw));
          const bHasSideA = sideA.some((kw) => textB.includes(kw));
          const bHasSideB = sideB.some((kw) => textB.includes(kw));

          // Speaker A says side-A things, Speaker B says side-B things (or vice versa)
          if ((aHasSideA && bHasSideB) || (aHasSideB && bHasSideA)) {
            logger.info('Disagreement detected', {
              agendaItemIndex,
              speakerA: latestRoundEntries[i].speakerId,
              speakerB: latestRoundEntries[j].speakerId,
            } as Record<string, unknown>);
            return true;
          }
        }
      }
    }

    return false;
  }
}
