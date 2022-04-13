import { Process } from './process';

export interface ProcedureStep {
  ordinal: number;
  script: string;
  duration: number;
  threadsNeeded: number;
  ramNeeded: number;
  securityLevelIncrease?: number;
  delay?: number;
}

export interface Procedure {
  type: 'prepare' | 'exploit';
  steps: ProcedureStep[];
  totalDuration: number;
  totalRamNeeded: number;
}

export interface QueuedProcedure {
  host: string;
  procedure: Procedure;
}

export interface RunningProcedure {
  processId: string;
  timeStarted: number;
  procedure: Procedure;
  processes: Process[];
}

export interface ScheduledHost {
  host: string;
  assignedProcedure: 'prepare' | 'exploit';
  runningProcedures: Map<string, RunningProcedure>;
  queued: boolean;
}
