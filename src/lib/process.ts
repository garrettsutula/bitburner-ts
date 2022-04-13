import { NS } from '@ns'
import { execa } from './exec';
import { Process } from '/models/process'
import { ControlledServers } from '/models/server';
import { Args } from '/models/utility';

export function killProcesses(ns: NS, processes: Process[]): boolean[] {
  return processes.map(({ host, script, args }: {host: string, script: string, args: Args}) => ns.kill(script, host, ...args));
}

export async function scheduleAcrossHosts(
  ns: NS,
  controlledHostsWithMetadata: ControlledServers[],
  jobScript: string,
  jobThreads: number,
  ...args: (string | number | boolean)[]
): Promise<Process[]> {
  const startedProcesses = [];
  const ramPerTask = ns.getScriptRam(jobScript, 'home');

  while (jobThreads > 0 && controlledHostsWithMetadata.length > 0) {
    const numThisHost = Math.min(
      Math.floor(controlledHostsWithMetadata[0].availableRam / ramPerTask),
      jobThreads,
    );

    jobThreads -= numThisHost;
    if (numThisHost > 0) {
      execa(ns, jobScript, controlledHostsWithMetadata[0].host, numThisHost, ...args);
      startedProcesses.push({ host: controlledHostsWithMetadata[0].host, script: jobScript, args });
    }

    if (jobThreads > 0) {
      controlledHostsWithMetadata.shift();
    } else {
      controlledHostsWithMetadata[0].availableRam -= numThisHost * ramPerTask;
    }
  }
  return startedProcesses;
}