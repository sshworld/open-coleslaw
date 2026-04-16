export type WorkerStatus = 'pending' | 'running' | 'completed' | 'failed';
export type TaskType = 'research' | 'implementation' | 'analysis' | 'testing';

export interface WorkerRecord {
  id: string;
  leaderId: string;
  meetingId: string;
  taskDescription: string;
  taskType: TaskType | null;
  status: WorkerStatus;
  inputContext: string | null;
  outputResult: string | null;
  errorMessage: string | null;
  dependencies: string[];
  spawnedAt: number;
  completedAt: number | null;
  costUsd: number;
}

export interface TaskAssignment {
  workerId: string;
  description: string;
  inputPaths: string[];
  outputPath: string;
  dependencies: string[];
  status: WorkerStatus;
  result: string | null;
}

export interface WorkerManifest {
  leaderId: string;
  workers: TaskAssignment[];
  aggregationStrategy: 'merge-all' | 'best-of' | 'sequential-chain';
}
