import { Process } from '/models/process';

export interface ProcedureStep {
  script: string;
  duration: number;
  threadsNeeded: number;
  ramNeeded: number;
  securityLevelIncrease?: number;
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
