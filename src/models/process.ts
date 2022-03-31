import { NS } from '@ns'

export interface Process {
  host: string;
  script: string;
  args: Array<string | number>
}

export interface HostProcesses {
  [index: number]: Process
}

export interface RunningProcessesInterface {
  weakening: Map<string, HostProcesses>
  growing: Map<string, HostProcesses>
  hacking: Map<string, HostProcesses>
}

export class RunningProcesses implements RunningProcessesInterface {
  weakening = new Map<string, HostProcesses>();
  growing = new Map<string, HostProcesses>();
  hacking = new Map<string, HostProcesses>();
}