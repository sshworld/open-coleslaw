export type MentionUrgency = 'blocking' | 'advisory';
export type MentionStatus = 'pending' | 'resolved' | 'expired';

export interface MentionOption {
  label: string;
  description: string;
  supportedBy: string[];
}

export interface MentionRecord {
  id: string;
  meetingId: string;
  agendaItem: string | null;
  summary: string;
  options: MentionOption[];
  urgency: MentionUrgency;
  status: MentionStatus;
  userDecision: string | null;
  userReasoning: string | null;
  createdAt: number;
  resolvedAt: number | null;
}
