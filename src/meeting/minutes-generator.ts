/**
 * Transforms a meeting transcript into PRD-format minutes.
 *
 * Since we don't have LLM calls at this layer, the generator performs
 * structured keyword-based extraction to identify decisions, open questions,
 * and action items from the raw transcript entries.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../storage/db.js';
import { getMeeting, createMinutes } from '../storage/index.js';
import type { TranscriptEntry, MinutesRecord, ActionItem } from '../types/index.js';
import { fillPrdTemplate } from './templates.js';
import type { PrdTemplateData, PrdAgendaItem, PrdActionRow } from './templates.js';
import { saveMinutesToFile, updateMinutesIndex, getNextSeqForToday } from './minutes-file-store.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Keyword sets for structured extraction
// ---------------------------------------------------------------------------

const DECISION_KEYWORDS = [
  '결정', 'decide', 'decided', 'agree', 'agreed', 'approved',
  '선택', 'chosen', 'concluded', 'resolved',
];

const ACTION_KEYWORDS = [
  '해야', 'should', 'must', 'need to', 'needs to',
  '구현', 'implement', 'will do', 'action item',
  'todo', 'to-do', 'assigned',
];

const QUESTION_KEYWORDS = [
  '?', '질문', 'question', 'unclear', 'tbd',
  'need to clarify', 'open question', 'investigate',
  '확인', 'clarify',
];

// ---------------------------------------------------------------------------
// Transcript row shape (matches the DB schema)
// ---------------------------------------------------------------------------

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

function rowToTranscriptEntry(row: TranscriptRow): TranscriptEntry {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    speakerId: row.speaker_id,
    speakerRole: row.speaker_role,
    agendaItemIndex: row.agenda_item_index,
    roundNumber: row.round_number,
    content: row.content,
    tokenCount: row.token_count,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function containsKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function extractSentencesWithKeywords(
  text: string,
  keywords: string[],
): string[] {
  // Split on sentence-ish boundaries
  const sentences = text.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  return sentences.filter((s) => containsKeyword(s, keywords));
}

function groupByAgendaItem(
  entries: TranscriptEntry[],
): Map<number, TranscriptEntry[]> {
  const groups = new Map<number, TranscriptEntry[]>();
  for (const entry of entries) {
    const idx = entry.agendaItemIndex;
    const list = groups.get(idx) ?? [];
    list.push(entry);
    groups.set(idx, list);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// MinutesGenerator
// ---------------------------------------------------------------------------

export class MinutesGenerator {
  /**
   * Generate PRD-format minutes from a completed meeting's transcript.
   *
   * 1. Load meeting + all transcript entries from storage
   * 2. Group transcript entries by agenda item
   * 3. For each agenda item, extract: discussion summary, decisions, open
   *    questions, action items
   * 4. Fill the PRD template
   * 5. Extract structured action items
   * 6. Save to storage and return
   */
  async generateMinutes(meetingId: string): Promise<MinutesRecord> {
    logger.info('Generating minutes', { meetingId });

    // 1. Load meeting
    const meeting = getMeeting(meetingId);
    if (!meeting) {
      throw new Error(`Meeting not found: ${meetingId}`);
    }

    // Load transcript entries
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM transcript_entries WHERE meeting_id = ? ORDER BY agenda_item_index ASC, round_number ASC, created_at ASC',
      )
      .all(meetingId) as TranscriptRow[];

    const entries = rows.map(rowToTranscriptEntry);

    // 2. Group by agenda item
    const grouped = groupByAgendaItem(entries);

    // 3. Extract per agenda item
    const agendaItems: PrdAgendaItem[] = [];
    const allActionItems: ActionItem[] = [];
    let actionCounter = 0;

    for (let i = 0; i < meeting.agenda.length; i++) {
      const itemEntries = grouped.get(i) ?? [];
      const combinedText = itemEntries.map((e) => e.content).join('\n');

      // Discussion = concatenation with speaker attribution
      const discussion =
        itemEntries.length > 0
          ? itemEntries
              .map((e) => `[${e.speakerRole}] ${e.content}`)
              .join('\n')
          : 'No discussion recorded for this item.';

      // Decisions
      let decisions = extractSentencesWithKeywords(combinedText, DECISION_KEYWORDS);
      if (decisions.length === 0 && itemEntries.length > 0) {
        decisions = ['No explicit decisions recorded'];
      }

      // Open questions
      let openQuestions = extractSentencesWithKeywords(combinedText, QUESTION_KEYWORDS);
      if (openQuestions.length === 0) {
        openQuestions = ['None'];
      }

      // Action items (text)
      const actionTexts = extractSentencesWithKeywords(combinedText, ACTION_KEYWORDS);
      const itemActionItems: string[] =
        actionTexts.length > 0 ? actionTexts : ['No action items identified'];

      agendaItems.push({
        title: meeting.agenda[i],
        discussion,
        decisions,
        openQuestions,
        actionItems: itemActionItems,
      });

      // Structured action items
      for (const actionText of actionTexts) {
        actionCounter += 1;
        allActionItems.push({
          id: uuidv4(),
          title: `Action ${actionCounter}: ${meeting.agenda[i]}`,
          description: actionText,
          assignedDepartment: 'engineering', // default; compactor refines this
          assignedRole: 'engineer',
          priority: 'medium',
          dependencies: [],
          acceptanceCriteria: [],
        });
      }
    }

    // 4. Build action summary table
    const actionSummaryRows: PrdActionRow[] = allActionItems.map(
      (item, idx) => ({
        index: idx + 1,
        action: item.description,
        owner: item.assignedDepartment,
        priority: item.priority,
        dependencies: item.dependencies.length > 0
          ? item.dependencies.join(', ')
          : 'None',
      }),
    );

    // Executive summary
    const executiveSummary =
      entries.length > 0
        ? `Meeting on "${meeting.topic}" with ${meeting.participantIds.length} participants. ` +
          `Covered ${meeting.agenda.length} agenda items across ${entries.length} transcript entries. ` +
          `Identified ${allActionItems.length} action items.`
        : `Meeting on "${meeting.topic}" — no transcript entries recorded.`;

    // Technical specs: collect any entries that mention technical terms
    const techEntries = entries.filter(
      (e) =>
        containsKeyword(e.content, [
          'api', 'schema', 'database', 'architecture', 'interface',
          'endpoint', 'migration', 'deploy', 'config', 'spec',
        ]),
    );
    const technicalSpecs =
      techEntries.length > 0
        ? techEntries.map((e) => `- [${e.speakerRole}] ${e.content}`).join('\n')
        : 'No technical specifications recorded.';

    // Next steps
    const nextSteps =
      allActionItems.length > 0
        ? allActionItems
            .slice(0, 5)
            .map((item, i) => `${i + 1}. ${item.description}`)
            .join('\n')
        : 'No next steps identified.';

    const templateData: PrdTemplateData = {
      topic: meeting.topic,
      date: new Date().toISOString().split('T')[0],
      participants: meeting.participantIds.join(', '),
      status: meeting.status,
      executiveSummary,
      agendaItems,
      technicalSpecs,
      actionItemsSummary: actionSummaryRows,
      nextSteps,
    };

    // 5. Fill template
    const content = fillPrdTemplate(templateData);

    // 6. Save to storage (SQLite)
    const record = createMinutes({
      meetingId,
      format: 'prd',
      content,
      actionItems: allActionItems,
    });

    // 7. Save to file system as markdown with frontmatter
    const allDecisions = agendaItems.flatMap((item) =>
      item.decisions.filter((d) => d !== 'No explicit decisions recorded'),
    );
    const filePath = saveMinutesToFile(
      meetingId,
      meeting.topic,
      meeting.participantIds,
      content,
      undefined, // tags auto-extracted from content
      allDecisions,
    );

    // 8. Update the INDEX.md
    const date = new Date().toISOString().split('T')[0];
    const seq = getNextSeqForToday() - 1; // seq was just incremented by saveMinutesToFile
    const filename = filePath.split('/').pop() ?? '';
    updateMinutesIndex({
      date,
      seq,
      topic: meeting.topic,
      filename,
      participants: meeting.participantIds,
      decisions: allDecisions,
    });

    logger.info('Minutes generated', {
      meetingId,
      actionItemCount: allActionItems.length,
      filePath,
    } as Record<string, unknown>);

    return record;
  }
}
