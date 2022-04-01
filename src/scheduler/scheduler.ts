import { NS } from '@ns';
import { readJson } from 'lib/file';
import { disableLogs } from 'lib/logs';
import { readPortJson, writePortJson } from '/lib/port';
import { shortId } from '/lib/uuid';
import { QueuedProcedure, RunningProcedure, ScheduledHost } from '/models/procedure';
import { NewRunningProcesses } from '/models/process';
import { ControlledServers } from '/models/server';
import { GenericObject } from '/models/utility';
import { exploitSchedule } from '/scheduler/stages/exploit';
import { prepareSchedule } from '/scheduler/stages/prepare';

const minHomeRamAvailable = 32;
const procedureSafetyBufferMs = 1000 * 3;

function getControlledHostsWithMetadata(ns: NS, hosts: string[]): ControlledServers[] {
  return hosts.map((host) => {
    let availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
    if (host === 'home') {
      availableRam = Math.max(0, availableRam - minHomeRamAvailable);
    }
    return {
      host,
      availableRam,
    };
  });
}

function getProcedure(ns: NS, {host, assignedProcedure}: ScheduledHost) {
  switch(assignedProcedure) {
    case 'prepare':
      return prepareSchedule(ns, host);
    case 'exploit':
      return exploitSchedule(ns, host);
    default:
      throw new Error(`Unrecognized procedure: ${assignedProcedure}`);
  }
}

export async function main(ns : NS) : Promise<void> {
  const scheduledHosts = new Map<string, ScheduledHost>();
  const procedureQueue: QueuedProcedure[] = [];
  disableLogs(ns);

  // Load rooted hosts (found, rooted in network) and controlled hosts (home + servers + rooted).
  const rootedHosts = readJson(ns, '/data/rootedHosts.txt') as string[];
  const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[];

  // Set initial schedule for rooted hosts.
  // This doesn't kill or change anything we have running.
  rootedHosts
  .forEach((host) => {
    const currentSecurityLevel = ns.getServerSecurityLevel(host);
    const minSecurityLevel = ns.getServerMinSecurityLevel(host);
    if (currentSecurityLevel > minSecurityLevel + 2) {
      scheduledHosts.set(host, {
        host,
        assignedProcedure: 'prepare',
        runningProcedures: new Map(),
        queued: false,
      })
    } else {
      scheduledHosts.set(host, {
        host,
        assignedProcedure: 'exploit',
        runningProcedures: new Map(),
        queued: false,
      })
    }
  });

  // Ports used:
  // 7 - Send instructions to manage-procedure scripts to tell them what to do.
  // 8 - Receive 

  while (true) {
    const scheduledHostsArr = Array.from(scheduledHosts.values());
    if (procedureQueue.length < 5) {
      // Queue new procedure for any hosts that don't have one running already.
      const scheduledNotRunning = scheduledHostsArr
        .filter((scheduledHost) => 
        // Not Running
        scheduledHost.runningProcedures.size === 0
        // Not queued (avoid queue depth overload)
        && !scheduledHost.queued
        // On the 'prepare' stage
        && scheduledHost.assignedProcedure === 'prepare'
        );

      for (const scheduledHost of scheduledNotRunning) {
        const procedure = getProcedure(ns, scheduledHost);
          procedureQueue.push({
            host: scheduledHost.host,
            procedure,
          });
          scheduledHost.queued = true;
      }

      // Queue follow-up exploit procedure for any that are currently running.
      const scheduledAndRunnningExploit = scheduledHostsArr
        .filter((scheduledHost) => 
          // Running
          scheduledHost.runningProcedures.size
          // But not queued (avoid queue depth overload)
          && !scheduledHost.queued
          // And after the 'prepare' stage
          && scheduledHost.assignedProcedure === 'exploit');

        for (const scheduledHost of scheduledAndRunnningExploit) {
          const procedure = getProcedure(ns, scheduledHost);
            procedureQueue.push({
              host: scheduledHost.host,
              procedure,
            });
            scheduledHost.queued = true;
      }
    }

    // Execution loop, empty the queue until we OOM
    const controlledHostsWithMetadata = getControlledHostsWithMetadata(ns, controlledHosts);
    let totalAvailableRam = controlledHostsWithMetadata.reduce((acc, {availableRam}) => acc + availableRam, 0);
    while(procedureQueue.length > 0) {
      const currentProcedure = procedureQueue.shift() as QueuedProcedure;
      const currentHost = scheduledHosts.get(currentProcedure.host) as ScheduledHost;
      const hostRunningProceduresArr = Array.from(currentHost.runningProcedures.values());
      const expectedEndTimes = hostRunningProceduresArr
        .map(({timeStarted, procedure}) => timeStarted + procedure.totalDuration)
      if (
        // Make sure we have enough RAM to instantiate this Procedure.
        currentProcedure.procedure.totalRamNeeded < totalAvailableRam
        // Check timing, now + duration needs to exceed every expected procedure end time.
        && expectedEndTimes.every((time) => time < (Date.now() + currentProcedure.procedure.totalDuration) + procedureSafetyBufferMs)
        ) {
        const processId = shortId();
        await writePortJson(ns, 7, currentProcedure);
        ns.run('/scheduler/manage-procedure.js', 1, processId);
        totalAvailableRam -= currentProcedure.procedure.totalRamNeeded;
        while(ns.peek(8) === 'NULL PORT DATA') await ns.sleep(30);
        const { processes } = readPortJson(ns, 8) as NewRunningProcesses;
        currentHost.runningProcedures.set(processId, {
          processId,
          processes,
          timeStarted: Date.now(),
          procedure: currentProcedure.procedure,
        });
        currentHost.queued = false;
      } else {
        procedureQueue.unshift(currentProcedure);
        ns.tprint(`WARN: Out of memory, ${procedureQueue.length} items remain in current queue`);
        break;
      }
    }

    // Read any running processes out of queue, only the first step will be read from the port when executing above.
    while (ns.peek(8) !== 'NULL PORT DATE') {
      const { host, processId, processes } = readPortJson(ns, 8) as NewRunningProcesses;
      const scheduledHost = scheduledHosts.get(host) as ScheduledHost;
      const procedure = scheduledHost.runningProcedures.get(processId) as RunningProcedure;
      procedure.processes.push(...processes);
    }

    // Read queue signals and update running processes.
    while (ns.peek(9) !== 'NULL PORT DATA') {
      const { host, processId } = readPortJson(ns, 9) as GenericObject;
      const scheduledHost = scheduledHosts.get(host) as ScheduledHost;
      scheduledHost.runningProcedures.delete(processId);
      // If needed, move the host to the exploit Procedure now that it is prepared.
      if (scheduledHost.assignedProcedure === 'prepare') scheduledHost.assignedProcedure = 'exploit';
    }
    await ns.sleep(500);
  }
}
