import { Process } from './process';

export type Task = "hack" | "grow" | "weaken" | "cancelled" | "desync" | "safe" | "unsafe";

export interface ProcedureStep {
  task: Task;
  ordinal: number;
  script: string;
  duration: number;
  threadsNeeded: number;
  ramNeeded: number;
  securityLevelIncrease?: number;
  delay: number;
}

export interface Job {
  processId: string;
  task: Task;
  duration: number;
  startTime: number;
  startTimeActual?: number;
  endTime?: number;
  endTimeActual?: number;
  cancelled?: boolean;
  result?: JobResult
}

export interface JobStartLog {
  batchId: string;
  processId: string;
  task: Task;
  duration: number;
  startTime: number;
  endTime: number;
}

export interface ScriptStartLog {
  batchId: string;
  processId: string;
  startTimeActual: number;
}

export interface ScriptEndLog {
  batchId: string;
  processId: string;
  endTimeActual: number;
  result: JobResult;
}

export interface JobResult {
  hackDiffulty?: number;
  minDifficulty?: number;
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
  startTime: number;
  procedure: Procedure;
  processes: Process[];

}

export interface ScheduledHost {
  host: string;
  assignedProcedure: 'prepare' | 'exploit';
  runningProcedures: RunningProcedure[];
  queued: boolean;
}


/**
 * Job data structure
 * @typedef {Object} Job
 * @property {string} task - name of the netscript function to call (hack, grow, weaken)
 * @property {number} duration - duration in milliseconds
 * @property {number} startTime - timestamp of expected start
 * @property {number} startTimeActual - timestamp of actual start (optional)
 * @property {number} endTime - timestamp of expected end
 * @property {number} endTimeActual - timestamp of actual end (optional)
 * @property {boolean} cancelled - whether the job has been cancelled (optional)
 * @property {Object} result - expected server state after the job completes
 * @property {number} result.hackDifficulty
 * @property {number} result.minDifficulty
 */