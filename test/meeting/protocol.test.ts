import { describe, it, expect, beforeEach } from 'vitest';
import { MeetingProtocol } from '../../src/meeting/protocol.js';

describe('MeetingProtocol', () => {
  const meetingId = 'meeting-001';
  const agenda = ['Design the API', 'Review dependencies', 'Plan testing strategy'];
  const participants = ['architect', 'engineer', 'qa'];
  let protocol: MeetingProtocol;

  beforeEach(() => {
    protocol = new MeetingProtocol(meetingId, agenda, participants);
  });

  describe('constructor', () => {
    it('initializes with provided participants and agenda', () => {
      // After construction, the first agenda item should be available
      const item = protocol.getCurrentAgendaItem();
      expect(item).not.toBeNull();
      expect(item!.index).toBe(0);
      expect(item!.item).toBe('Design the API');
    });
  });

  describe('getCurrentAgendaItem', () => {
    it('returns the first item initially', () => {
      const item = protocol.getCurrentAgendaItem();
      expect(item).toEqual({ index: 0, item: 'Design the API' });
    });

    it('returns null when all items are exhausted', () => {
      protocol.advanceAgendaItem(); // move to item 1
      protocol.advanceAgendaItem(); // move to item 2
      protocol.advanceAgendaItem(); // move past all items
      expect(protocol.getCurrentAgendaItem()).toBeNull();
    });
  });

  describe('getNextSpeaker', () => {
    it('cycles through participants round-robin', () => {
      expect(protocol.getNextSpeaker()).toBe('architect');
      expect(protocol.getNextSpeaker()).toBe('engineer');
      expect(protocol.getNextSpeaker()).toBe('qa');
      // Wraps around
      expect(protocol.getNextSpeaker()).toBe('architect');
    });

    it('returns null if there are no participants', () => {
      const emptyProtocol = new MeetingProtocol('m-empty', ['item'], []);
      expect(emptyProtocol.getNextSpeaker()).toBeNull();
    });
  });

  describe('advanceRound', () => {
    it('increments the round number', () => {
      const result = protocol.advanceRound();
      expect(result.round).toBe(2);
      expect(result.item).toBe(0);
    });

    it('resets speaker index to 0', () => {
      // Advance through some speakers
      protocol.getNextSpeaker(); // architect (index becomes 1)
      protocol.getNextSpeaker(); // engineer (index becomes 2)

      // Advance round resets speaker
      protocol.advanceRound();
      expect(protocol.getNextSpeaker()).toBe('architect');
    });

    it('increments round multiple times', () => {
      protocol.advanceRound(); // round 2
      const result = protocol.advanceRound(); // round 3
      expect(result.round).toBe(3);
    });
  });

  describe('advanceAgendaItem', () => {
    it('moves to the next agenda item', () => {
      const nextIndex = protocol.advanceAgendaItem();
      expect(nextIndex).toBe(1);
      const item = protocol.getCurrentAgendaItem();
      expect(item).toEqual({ index: 1, item: 'Review dependencies' });
    });

    it('resets round and speaker counters', () => {
      // Advance round and speaker
      protocol.advanceRound();
      protocol.getNextSpeaker();

      // Advance agenda item
      protocol.advanceAgendaItem();

      // Round should be reset to 1 and speaker to first
      expect(protocol.getNextSpeaker()).toBe('architect');
    });

    it('returns null when no more items', () => {
      protocol.advanceAgendaItem(); // item 1
      protocol.advanceAgendaItem(); // item 2
      const result = protocol.advanceAgendaItem(); // past end
      expect(result).toBeNull();
    });
  });

  describe('shouldEndDiscussion', () => {
    it('returns false for round 1 with maxRounds 3', () => {
      expect(protocol.shouldEndDiscussion(3)).toBe(false);
    });

    it('returns false for round 2 with maxRounds 3', () => {
      protocol.advanceRound(); // round 2
      expect(protocol.shouldEndDiscussion(3)).toBe(false);
    });

    it('returns false for round 3 with maxRounds 3', () => {
      protocol.advanceRound(); // round 2
      protocol.advanceRound(); // round 3
      expect(protocol.shouldEndDiscussion(3)).toBe(false);
    });

    it('returns true when round exceeds maxRounds', () => {
      protocol.advanceRound(); // round 2
      protocol.advanceRound(); // round 3
      protocol.advanceRound(); // round 4
      expect(protocol.shouldEndDiscussion(3)).toBe(true);
    });
  });

  describe('formatSpeakerContext', () => {
    it('includes the current agenda item in formatted context', () => {
      const context = protocol.formatSpeakerContext('architect', []);
      expect(context).toContain('Design the API');
      expect(context).toContain('Round');
    });

    it('indicates no prior discussion when transcript is empty', () => {
      const context = protocol.formatSpeakerContext('architect', []);
      expect(context).toContain('No prior discussion');
    });

    it('includes relevant transcript entries', () => {
      const transcript = [
        {
          id: 1,
          meetingId: 'meeting-001',
          speakerId: 'engineer',
          speakerRole: 'engineer',
          agendaItemIndex: 0,
          roundNumber: 1,
          content: 'We should use REST.',
          tokenCount: 10,
          createdAt: Date.now(),
        },
      ];
      const context = protocol.formatSpeakerContext('architect', transcript);
      expect(context).toContain('We should use REST.');
      expect(context).toContain('engineer');
    });

    it('returns message about no more items when agenda is exhausted', () => {
      protocol.advanceAgendaItem();
      protocol.advanceAgendaItem();
      protocol.advanceAgendaItem();
      const context = protocol.formatSpeakerContext('architect', []);
      expect(context).toContain('no more agenda items');
    });
  });
});
