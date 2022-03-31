import { NS } from '@ns'
import { execa } from 'spider/exec';
import { Process } from 'models/process'
import { ControlledServers } from 'models/server';

export function killProcesses(ns: NS, processes: Process[]): boolean[] {
  return processes.map(({ host, script, args }) => ns.kill(script, host, ...args));
}

export async function scheduleAcrossHosts(
  ns: NS,
  controlledHostsWithMetadata: ControlledServers,
  jobScript: string,
  jobThreads: number,
  jobTarget: string,
  tag: string
): HostProcesses {
  const startedProcesses = [];
  const ramPerTask = ns.getScriptRam(jobScript, 'home');

  while (jobThreads > 0 && controlledHostsWithMetadata.length > 0) {
    const numThisHost = Math.min(
      Math.floor(controlledHostsWithMetadata[0].availableRam / ramPerTask),
      jobThreads,
    );

    jobThreads -= numThisHost;
    const args = [jobScript, controlledHostsWithMetadata[0].host, numThisHost, jobTarget, tag];
    if (numThisHost > 0) {
      await execa(ns, args);
      startedProcesses.push({ host: controlledHostsWithMetadata[0].host, script: jobScript, args: [jobTarget, tag] });
    }

    if (jobThreads > 0) {
      controlledHostsWithMetadata.shift();
    } else {
      controlledHostsWithMetadata[0].availableRam -= numThisHost * ramPerTask;
    }
  }
  return startedProcesses;
}