import { describe, it, expect } from 'vitest';
import { MentionDetector } from '../../src/meeting/mention-detector.js';

describe('MentionDetector', () => {
  const detector = new MentionDetector();
  const meetingId = 'meeting-001';
  const agendaItem = 'Choose database engine';

  describe('detectMention', () => {
    it('detects @USER_DECISION_NEEDED marker and returns MentionRecord', () => {
      const response = `After discussion, we need user input.

@USER_DECISION_NEEDED: Which database should we use?
A) PostgreSQL - battle-tested relational DB
B) MongoDB - flexible document store
C) SQLite - lightweight embedded DB`;

      const record = detector.detectMention(response, meetingId, agendaItem);

      expect(record).not.toBeNull();
      expect(record!.meetingId).toBe(meetingId);
      expect(record!.agendaItem).toBe(agendaItem);
      expect(record!.summary).toBe('Which database should we use?');
      expect(record!.status).toBe('pending');
      expect(record!.urgency).toBe('advisory');
      expect(record!.userDecision).toBeNull();
      expect(record!.userReasoning).toBeNull();
    });

    it('returns null when no marker is present', () => {
      const response = 'Everything looks good, no user input needed.';
      const record = detector.detectMention(response, meetingId, agendaItem);
      expect(record).toBeNull();
    });

    it('parses options A)/B)/C) from response', () => {
      const response = `@USER_DECISION_NEEDED: How to handle auth?
A) JWT tokens
B) Session cookies
C) OAuth2 only`;

      const record = detector.detectMention(response, meetingId, agendaItem);

      expect(record).not.toBeNull();
      expect(record!.options).toHaveLength(3);
      expect(record!.options[0].label).toBe('A');
      expect(record!.options[0].description).toBe('JWT tokens');
      expect(record!.options[1].label).toBe('B');
      expect(record!.options[1].description).toBe('Session cookies');
      expect(record!.options[2].label).toBe('C');
      expect(record!.options[2].description).toBe('OAuth2 only');
    });

    it('provides default yes/no options when no structured options are given', () => {
      const response = '@USER_DECISION_NEEDED: Should we proceed with the migration?';

      const record = detector.detectMention(response, meetingId, agendaItem);

      expect(record).not.toBeNull();
      expect(record!.options).toHaveLength(2);
      expect(record!.options[0].label).toBe('A');
      expect(record!.options[0].description).toBe('Proceed as suggested');
      expect(record!.options[1].label).toBe('B');
      expect(record!.options[1].description).toBe('Defer or reject');
    });

    it('generates a unique id for each mention', () => {
      const response = '@USER_DECISION_NEEDED: Pick one.';
      const record1 = detector.detectMention(response, meetingId, agendaItem);
      const record2 = detector.detectMention(response, meetingId, agendaItem);
      expect(record1!.id).not.toBe(record2!.id);
    });
  });

  describe('detectDisagreement', () => {
    it('detects contradicting positions between two speakers at maxRounds', () => {
      const transcript = [
        {
          id: 1,
          meetingId: 'meeting-001',
          speakerId: 'architect',
          speakerRole: 'architect',
          agendaItemIndex: 0,
          roundNumber: 3,
          content: 'I agree we should use a simple monolith approach.',
          tokenCount: 10,
          createdAt: Date.now(),
        },
        {
          id: 2,
          meetingId: 'meeting-001',
          speakerId: 'engineer',
          speakerRole: 'engineer',
          agendaItemIndex: 0,
          roundNumber: 3,
          content: 'I disagree, we need a complex microservice architecture.',
          tokenCount: 10,
          createdAt: Date.now(),
        },
      ];

      const result = detector.detectDisagreement(transcript, 0, 3);
      expect(result).toBe(true);
    });

    it('returns false when round is below maxRounds', () => {
      const transcript = [
        {
          id: 1,
          meetingId: 'meeting-001',
          speakerId: 'architect',
          speakerRole: 'architect',
          agendaItemIndex: 0,
          roundNumber: 1,
          content: 'I agree with the proposal.',
          tokenCount: 10,
          createdAt: Date.now(),
        },
        {
          id: 2,
          meetingId: 'meeting-001',
          speakerId: 'engineer',
          speakerRole: 'engineer',
          agendaItemIndex: 0,
          roundNumber: 1,
          content: 'I disagree strongly.',
          tokenCount: 10,
          createdAt: Date.now(),
        },
      ];

      const result = detector.detectDisagreement(transcript, 0, 3);
      expect(result).toBe(false);
    });

    it('returns false when transcript is empty', () => {
      const result = detector.detectDisagreement([], 0, 3);
      expect(result).toBe(false);
    });

    it('returns false when only one speaker in the latest round', () => {
      const transcript = [
        {
          id: 1,
          meetingId: 'meeting-001',
          speakerId: 'architect',
          speakerRole: 'architect',
          agendaItemIndex: 0,
          roundNumber: 3,
          content: 'I support this approach.',
          tokenCount: 10,
          createdAt: Date.now(),
        },
      ];

      const result = detector.detectDisagreement(transcript, 0, 3);
      expect(result).toBe(false);
    });

    it('returns false when speakers agree using same-side keywords', () => {
      const transcript = [
        {
          id: 1,
          meetingId: 'meeting-001',
          speakerId: 'architect',
          speakerRole: 'architect',
          agendaItemIndex: 0,
          roundNumber: 3,
          content: 'I agree we should keep it simple.',
          tokenCount: 10,
          createdAt: Date.now(),
        },
        {
          id: 2,
          meetingId: 'meeting-001',
          speakerId: 'engineer',
          speakerRole: 'engineer',
          agendaItemIndex: 0,
          roundNumber: 3,
          content: 'Yes, I agree, a simple approach is best.',
          tokenCount: 10,
          createdAt: Date.now(),
        },
      ];

      const result = detector.detectDisagreement(transcript, 0, 3);
      expect(result).toBe(false);
    });
  });
});
