import type {
  AgentNode,
  Department,
  TranscriptEntry,
  MeetingStatus,
  MeetingPhase,
  MinutesRecord,
  ActionItem,
} from '../types/index.js';
import { DEFAULT_MEETING_CONFIG } from '../types/index.js';
import {
  getMeeting,
  updateMeeting,
  createMinutes,
} from '../storage/index.js';
import { getDb } from '../storage/db.js';
import { getLeaderSystemPrompt } from '../agents/leader-prompts.js';
import { createAgentConfig } from '../agents/agent-factory.js';
import { invokeClaude, buildInvokeOptions } from '../agents/claude-invoker.js';
import { eventBus } from './event-bus.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Agent query — uses Claude CLI or falls back to mock
// ---------------------------------------------------------------------------

interface AgentQueryConfig {
  role: string;
  department: Department;
  systemPrompt: string;
}

/**
 * Query a Claude agent via the CLI subprocess invoker.
 *
 * When COLESLAW_MOCK=1 is set or the `claude` CLI is not available, this
 * automatically falls back to mock responses inside `invokeClaude`.
 */
async function queryAgent(config: AgentQueryConfig, prompt: string): Promise<string> {
  const agentConfig = createAgentConfig({
    tier: 'leader',
    role: config.role,
    department: config.department,
  });

  const invokeOpts = buildInvokeOptions(
    agentConfig,
    prompt,
    config.systemPrompt,
  );

  // Leaders get a 10-minute timeout
  invokeOpts.timeoutMs = 600_000;

  const result = await invokeClaude(invokeOpts);

  if (!result.success) {
    logger.warn(`Agent query failed for ${config.role}: ${result.error}`);
    // Return the error as content so the meeting can continue
    return `[Error from ${config.role}] ${result.error ?? 'Unknown error during agent invocation'}`;
  }

  return result.output;
}

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
// MeetingRunner
// ---------------------------------------------------------------------------

export class MeetingRunner {
  private readonly meetingId: string;
  private readonly leaders: AgentNode[];
  private readonly maxRoundsPerItem: number;
  private readonly projectContext: string | undefined;

  constructor(meetingId: string, leaders: AgentNode[], projectContext?: string) {
    this.meetingId = meetingId;
    this.leaders = leaders;
    this.maxRoundsPerItem = DEFAULT_MEETING_CONFIG.maxRoundsPerItem;
    this.projectContext = projectContext;
  }

  // ---- public entry point -------------------------------------------------

  /**
   * Run the complete meeting lifecycle: opening -> discussion -> synthesis -> minutes.
   */
  async run(): Promise<void> {
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
        status: 'completed' as MeetingStatus,
        completedAt: Date.now(),
      });

      logger.info(`Meeting completed: ${meeting.topic}`, { meetingId: this.meetingId });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Meeting failed: ${errorMsg}`, { meetingId: this.meetingId });

      updateMeeting(this.meetingId, {
        status: 'failed' as MeetingStatus,
        completedAt: Date.now(),
      });

      throw err;
    }
  }

  // ---- phases -------------------------------------------------------------

  /**
   * Opening phase: each leader states their initial position on the meeting
   * topic and agenda.
   */
  private async openingPhase(): Promise<void> {
    this.setPhase('opening');

    const meeting = getMeeting(this.meetingId)!;
    const agendaText = meeting.agenda.map((a, i) => `  ${i + 1}. ${a}`).join('\n');

    for (const leader of this.leaders) {
      const prompt =
        `MEETING OPENING\n\n` +
        `Topic: ${meeting.topic}\n` +
        `Agenda:\n${agendaText}\n\n` +
        `Please state your initial position on this topic from your department's perspective. ` +
        `Identify any concerns, dependencies, or risks relevant to your area.`;

      const config: AgentQueryConfig = {
        role: leader.role,
        department: leader.department,
        systemPrompt: getLeaderSystemPrompt(leader.department, undefined, this.projectContext),
      };

      const response = await queryAgent(config, prompt);

      insertTranscriptEntry(
        this.meetingId,
        leader.id,
        leader.role,
        -1, // -1 signals the opening phase (not tied to a specific agenda item)
        0,
        response,
      );

      eventBus.emitAgentEvent({
        kind: 'message_sent',
        fromId: leader.id,
        toId: 'meeting',
        summary: `[Opening] ${leader.role}: ${response.slice(0, 80)}...`,
      });

      logger.debug(`Opening statement from ${leader.role}`, {
        meetingId: this.meetingId,
        agentId: leader.id,
      });
    }
  }

  /**
   * Discussion phase: for each agenda item, leaders take turns responding in
   * round-robin fashion for up to `maxRoundsPerItem` rounds.
   */
  private async discussionPhase(): Promise<void> {
    this.setPhase('discussion');

    const meeting = getMeeting(this.meetingId)!;

    for (let itemIdx = 0; itemIdx < meeting.agenda.length; itemIdx++) {
      const agendaItem = meeting.agenda[itemIdx];

      logger.info(`Discussing agenda item ${itemIdx + 1}: ${agendaItem}`, {
        meetingId: this.meetingId,
      });

      for (let round = 1; round <= this.maxRoundsPerItem; round++) {
        for (const leader of this.leaders) {
          // Build the prompt with full transcript context
          const transcript = getTranscript(this.meetingId);
          const transcriptText = this.formatTranscript(transcript);

          const prompt =
            `MEETING DISCUSSION — Round ${round}/${this.maxRoundsPerItem}\n\n` +
            `Current agenda item (${itemIdx + 1}/${meeting.agenda.length}): ${agendaItem}\n\n` +
            `Transcript so far:\n${transcriptText}\n\n` +
            `Provide your department's perspective on this agenda item. ` +
            `Build on what others have said. If you agree, say so and add specifics. ` +
            `If you disagree, state your reasoning and propose an alternative.`;

          const config: AgentQueryConfig = {
            role: leader.role,
            department: leader.department,
            systemPrompt: getLeaderSystemPrompt(leader.department, undefined, this.projectContext),
          };

          const response = await queryAgent(config, prompt);

          insertTranscriptEntry(
            this.meetingId,
            leader.id,
            leader.role,
            itemIdx,
            round,
            response,
          );

          eventBus.emitAgentEvent({
            kind: 'message_sent',
            fromId: leader.id,
            toId: 'meeting',
            summary: `[Item ${itemIdx + 1}, R${round}] ${leader.role}: ${response.slice(0, 80)}...`,
          });
        }
      }
    }
  }

  /**
   * Synthesis phase: each leader states their final position, commitments,
   * and action items.
   */
  private async synthesisPhase(): Promise<void> {
    this.setPhase('synthesis');

    const transcript = getTranscript(this.meetingId);
    const transcriptText = this.formatTranscript(transcript);

    for (const leader of this.leaders) {
      const prompt =
        `MEETING SYNTHESIS\n\n` +
        `The discussion is complete. Here is the full transcript:\n${transcriptText}\n\n` +
        `State your final position. List the action items your department commits to. ` +
        `Flag any unresolved concerns or items requiring user decision.`;

      const config: AgentQueryConfig = {
        role: leader.role,
        department: leader.department,
        systemPrompt: getLeaderSystemPrompt(leader.department, undefined, this.projectContext),
      };

      const response = await queryAgent(config, prompt);

      insertTranscriptEntry(
        this.meetingId,
        leader.id,
        leader.role,
        -2, // -2 signals synthesis phase
        0,
        response,
      );

      eventBus.emitAgentEvent({
        kind: 'message_sent',
        fromId: leader.id,
        toId: 'meeting',
        summary: `[Synthesis] ${leader.role}: ${response.slice(0, 80)}...`,
      });
    }
  }

  /**
   * Generate meeting minutes by concatenating and formatting the transcript.
   *
   * In the future this will use a dedicated minutes-writer agent.  For now it
   * formats the transcript into a structured summary.
   */
  private async generateMinutes(): Promise<void> {
    this.setPhase('minutes-generation');

    const meeting = getMeeting(this.meetingId)!;
    const transcript = getTranscript(this.meetingId);

    // --- Build the minutes content ---

    const sections: string[] = [];

    sections.push(`# Meeting Minutes`);
    sections.push(`## Topic: ${meeting.topic}`);
    sections.push(`## Date: ${new Date().toISOString()}`);
    sections.push(`## Participants: ${this.leaders.map((l) => l.role).join(', ')}`);
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

    const actionItems: ActionItem[] = this.leaders.map((leader, idx) => ({
      id: `action-${this.meetingId}-${idx}`,
      title: `${leader.role} deliverables`,
      description: `Action items committed by ${leader.role} during synthesis phase`,
      assignedDepartment: leader.department,
      assignedRole: leader.role,
      priority: 'medium' as const,
      dependencies: [],
      acceptanceCriteria: ['Deliverables completed as stated in final position'],
    }));

    createMinutes({
      meetingId: this.meetingId,
      format: 'summary',
      content,
      actionItems,
    });

    logger.info('Minutes generated', { meetingId: this.meetingId });
  }

  // ---- helpers ------------------------------------------------------------

  private setPhase(phase: MeetingPhase): void {
    const statusMap: Record<MeetingPhase, MeetingStatus> = {
      'orchestrator-phase': 'pending',
      'convening': 'convening',
      'opening': 'opening',
      'discussion': 'discussion',
      'research-break': 'discussion',
      'synthesis': 'synthesis',
      'minutes-generation': 'minutes-generation',
    };

    updateMeeting(this.meetingId, {
      phase,
      status: statusMap[phase] ?? 'discussion',
    });

    logger.debug(`Meeting phase: ${phase}`, { meetingId: this.meetingId });
  }

  private formatTranscript(entries: TranscriptEntry[]): string {
    if (entries.length === 0) return '(No transcript entries yet)';

    return entries
      .map((e) => {
        let phaseLabel: string;
        if (e.agendaItemIndex === -1) phaseLabel = 'Opening';
        else if (e.agendaItemIndex === -2) phaseLabel = 'Synthesis';
        else phaseLabel = `Item ${e.agendaItemIndex + 1}, Round ${e.roundNumber}`;
        return `[${phaseLabel}] ${e.speakerRole}: ${e.content}`;
      })
      .join('\n\n');
  }
}
