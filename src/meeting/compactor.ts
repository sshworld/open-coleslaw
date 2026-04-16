/**
 * Compacts meeting minutes into a structured task list per department.
 *
 * Assigns departments and priorities based on keyword analysis.
 */

import { v4 as uuidv4 } from 'uuid';
import { getMinutesByMeeting, createMinutes } from '../storage/index.js';
import { getDb } from '../storage/db.js';
import type { ActionItem, Department, MinutesRecord } from '../types/index.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Keyword → department mapping
// ---------------------------------------------------------------------------

const DEPARTMENT_KEYWORDS: Record<Department, string[]> = {
  architecture: [
    'schema', 'design', 'architecture', 'blueprint', 'dependency',
    'api design', 'system design', '아키텍처', '설계',
  ],
  engineering: [
    'implement', 'code', 'develop', 'build', 'refactor', 'fix',
    'feature', 'module', '구현', '개발', '코드',
  ],
  qa: [
    'test', 'quality', 'coverage', 'security', 'audit', 'performance',
    'regression', 'validation', '테스트', '검증', '품질',
  ],
  product: [
    'requirement', 'user story', 'acceptance criteria', 'stakeholder',
    'priority', 'roadmap', 'scope', '요구사항', '사용자',
  ],
  research: [
    'research', 'explore', 'investigate', 'benchmark', 'compare',
    'evaluate', 'poc', 'prototype', '조사', '탐색',
  ],
};

// ---------------------------------------------------------------------------
// Keyword → priority mapping
// ---------------------------------------------------------------------------

const PRIORITY_KEYWORDS: Record<ActionItem['priority'], string[]> = {
  critical: [
    'critical', 'urgent', 'blocker', 'blocking', 'asap', 'immediately',
    '긴급', '즉시', 'p0',
  ],
  high: [
    'high priority', 'important', 'must', 'required', 'essential',
    '중요', '필수', 'p1',
  ],
  medium: [
    'medium', 'should', 'moderate', '보통', 'p2',
  ],
  low: [
    'low priority', 'nice to have', 'optional', 'consider',
    '낮음', '선택', 'p3',
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectDepartment(text: string): Department {
  const lower = text.toLowerCase();
  let bestDept: Department = 'engineering';
  let bestScore = 0;

  for (const [dept, keywords] of Object.entries(DEPARTMENT_KEYWORDS) as [Department, string[]][]) {
    const score = keywords.reduce(
      (acc, kw) => acc + (lower.includes(kw.toLowerCase()) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestDept = dept;
    }
  }

  return bestDept;
}

function detectPriority(text: string): ActionItem['priority'] {
  const lower = text.toLowerCase();

  // Check from highest to lowest — first match wins
  for (const priority of ['critical', 'high', 'medium', 'low'] as const) {
    const keywords = PRIORITY_KEYWORDS[priority];
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return priority;
    }
  }

  return 'medium';
}

const LEADER_ROLE_FOR_DEPT: Record<Department, string> = {
  architecture: 'architect',
  engineering: 'engineer',
  qa: 'qa',
  product: 'product-manager',
  research: 'researcher',
};

// ---------------------------------------------------------------------------
// Compactor
// ---------------------------------------------------------------------------

export class Compactor {
  /**
   * Compact minutes into actionable, department-assigned tasks.
   *
   * 1. Load minutes for the meeting
   * 2. Parse action items from the minutes content
   * 3. Assign each to a department based on keywords
   * 4. Set priorities based on keywords
   * 5. Save updated action items to minutes record
   * 6. Return the structured task list
   */
  async compactMinutes(
    meetingId: string,
    additionalInstructions?: string,
  ): Promise<ActionItem[]> {
    logger.info('Compacting minutes', { meetingId });

    // 1. Load existing minutes
    const minutes = getMinutesByMeeting(meetingId);
    if (!minutes) {
      throw new Error(`No minutes found for meeting: ${meetingId}`);
    }

    // 2–4. Refine existing action items with department + priority detection
    const refinedItems: ActionItem[] = minutes.actionItems.map((item) => {
      const fullText = `${item.title} ${item.description} ${additionalInstructions ?? ''}`;
      const department = detectDepartment(fullText);
      const priority = detectPriority(fullText);

      return {
        ...item,
        assignedDepartment: department,
        assignedRole: LEADER_ROLE_FOR_DEPT[department],
        priority,
      };
    });

    // If there are no existing action items, try to extract from minutes content
    if (refinedItems.length === 0) {
      const extracted = this.extractFromContent(minutes.content);
      refinedItems.push(...extracted);
    }

    // 5. Update the minutes record in the DB
    const db = getDb();
    db.prepare('UPDATE minutes SET action_items = ? WHERE id = ?').run(
      JSON.stringify(refinedItems),
      minutes.id,
    );

    logger.info('Minutes compacted', {
      meetingId,
      actionItemCount: refinedItems.length,
    } as Record<string, unknown>);

    // 6. Return the structured task list
    return refinedItems;
  }

  // -------------------------------------------------------------------------
  // Fallback extraction from raw minutes content
  // -------------------------------------------------------------------------

  private extractFromContent(content: string): ActionItem[] {
    const items: ActionItem[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Look for lines that start with "- " or numbered items under action sections
      if (
        trimmed.startsWith('- ') &&
        trimmed.length > 5 &&
        trimmed !== '- None' &&
        trimmed !== '- None recorded' &&
        trimmed !== '- No action items identified' &&
        trimmed !== '- No action items recorded'
      ) {
        const text = trimmed.slice(2);
        const department = detectDepartment(text);
        const priority = detectPriority(text);

        items.push({
          id: uuidv4(),
          title: text.slice(0, 80),
          description: text,
          assignedDepartment: department,
          assignedRole: LEADER_ROLE_FOR_DEPT[department],
          priority,
          dependencies: [],
          acceptanceCriteria: [],
        });
      }
    }

    return items;
  }
}
