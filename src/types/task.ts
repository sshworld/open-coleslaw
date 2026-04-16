export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface TaskRecord {
  id: string;
  meetingId: string;
  minutesId: string;
  title: string;
  description: string;
  assignedRole: string;
  priority: TaskPriority;
  dependencies: string[];
  acceptanceCriteria: string[];
  status: TaskStatus;
  result: TaskResult | null;
  startedAt: number | null;
  completedAt: number | null;
}

export interface TaskResult {
  success: boolean;
  summary: string;
  filesModified: string[];
  output: string;
  error?: string;
}
