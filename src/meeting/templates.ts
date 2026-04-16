/**
 * PRD meeting minutes template and filler.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrdAgendaItem {
  title: string;
  discussion: string;
  decisions: string[];
  openQuestions: string[];
  actionItems: string[];
}

export interface PrdActionRow {
  index: number;
  action: string;
  owner: string;
  priority: string;
  dependencies: string;
}

export interface PrdTemplateData {
  topic: string;
  date: string;
  participants: string;
  status: string;
  executiveSummary: string;
  agendaItems: PrdAgendaItem[];
  technicalSpecs: string;
  actionItemsSummary: PrdActionRow[];
  nextSteps: string;
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const PRD_TEMPLATE = `# Meeting Minutes: {topic}
**Date**: {date} | **Participants**: {participants} | **Status**: {status}

## 1. Executive Summary
{summary}

## 2. Agenda Items
{agendaItems}

## 3. Technical Specifications
{specs}

## 4. Action Items Summary
| # | Action | Owner | Priority | Dependencies |
|---|--------|-------|----------|-------------|
{rows}

## 5. Next Steps
{nextSteps}`;

/**
 * Returns the raw PRD markdown template with placeholder tokens.
 */
export function getPrdTemplate(): string {
  return PRD_TEMPLATE;
}

// ---------------------------------------------------------------------------
// Filler
// ---------------------------------------------------------------------------

function formatAgendaItem(item: PrdAgendaItem, index: number): string {
  const sectionNum = `2.${index + 1}`;
  const decisions =
    item.decisions.length > 0
      ? item.decisions.map((d) => `- ${d}`).join('\n')
      : '- None recorded';
  const openQuestions =
    item.openQuestions.length > 0
      ? item.openQuestions.map((q) => `- ${q}`).join('\n')
      : '- None';
  const actionItems =
    item.actionItems.length > 0
      ? item.actionItems.map((a) => `- ${a}`).join('\n')
      : '- None';

  return `### ${sectionNum} ${item.title}
**Discussion Summary**: ${item.discussion}
**Decisions**:
${decisions}
**Open Questions**:
${openQuestions}
**Action Items**:
${actionItems}`;
}

function formatActionRow(row: PrdActionRow): string {
  return `| ${row.index} | ${row.action} | ${row.owner} | ${row.priority} | ${row.dependencies} |`;
}

/**
 * Fills the PRD template with the given data and returns the final markdown.
 */
export function fillPrdTemplate(data: PrdTemplateData): string {
  const agendaItemsBlock = data.agendaItems
    .map((item, i) => formatAgendaItem(item, i))
    .join('\n\n');

  const rowsBlock =
    data.actionItemsSummary.length > 0
      ? data.actionItemsSummary.map(formatActionRow).join('\n')
      : '| - | No action items recorded | - | - | - |';

  return PRD_TEMPLATE
    .replace('{topic}', data.topic)
    .replace('{date}', data.date)
    .replace('{participants}', data.participants)
    .replace('{status}', data.status)
    .replace('{summary}', data.executiveSummary)
    .replace('{agendaItems}', agendaItemsBlock)
    .replace('{specs}', data.technicalSpecs || 'No technical specifications recorded.')
    .replace('{rows}', rowsBlock)
    .replace('{nextSteps}', data.nextSteps || 'To be determined.');
}
