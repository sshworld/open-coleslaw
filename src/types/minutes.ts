export type MinutesFormat = 'prd' | 'summary' | 'tasks_only';

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  assignedDepartment: string;
  assignedRole: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  acceptanceCriteria: string[];
}

export interface MinutesRecord {
  id: string;
  meetingId: string;
  format: MinutesFormat;
  content: string;
  actionItems: ActionItem[];
  createdAt: number;
}
