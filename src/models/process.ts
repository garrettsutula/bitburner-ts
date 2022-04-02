import { Args } from '/models/utility';

export interface Process {
  host: string;
  script: string;
  args: (string | number | boolean)[];
}

export interface NewRunningProcesses {
  host: string;
  timeStarted: number;
  processId: string;
  processes: Process[];
}

export interface RunningProcessesInterface {
  weakening: Map<string, Process[]>
  growing: Map<string, Process[]>
  hacking: Map<string, Process[]>
}

export class RunningProcesses implements RunningProcessesInterface {
  weakening = new Map<string, Process[]>();
  growing = new Map<string, Process[]>();
  hacking = new Map<string, Process[]>();
}