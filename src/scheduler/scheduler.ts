import { NS } from '@ns';
import { readJson, writeJson } from 'lib/file';
import { disableLogs } from 'lib/logs';
import { clearPort, readPortJson, writePortJson } from '/lib/port';
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
  let count = 100;
  disableLogs(ns);
  clearPort(ns, 7);
  clearPort(ns, 8);
  clearPort(ns, 9);

  // Load rooted hosts (found, rooted in network) and controlled hosts (home + servers + rooted). 
  const exploitableHosts = (readJson(ns, '/data/exploitableHosts.txt') as string[]).reverse().slice(0,3);
  const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[];

  // Set initial schedule for rooted hosts.
  // This doesn't kill or change anything we have running.
  exploitableHosts
  .forEach((host) => {
    const isAlreadyWeakened = ns.getServerSecurityLevel(host) < ns.getServerMinSecurityLevel(host) + 2;
    const isAlreadyGrown = ns.getServerMaxMoney(host) * 0.90 < ns.getServerMoneyAvailable(host);
    if (!isAlreadyWeakened || !isAlreadyGrown ) {
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
    // Only attempt to queue new Procedures if our queue depth is shallow.
    if (procedureQueue.length < 5) {

      // Queue new prepare procedures
      const needToPrepare = scheduledHostsArr
        .filter((scheduledHost) => 
        // Not Running a prepare already
        scheduledHost.runningProcedures.size === 0
        // Not queued (avoid queue depth overload)
        && !scheduledHost.queued
        // On the 'prepare' stage
        && scheduledHost.assignedProcedure === 'prepare'
        );
      if (count % 100 === 0) ns.tprint(`${needToPrepare.length} hosts need to be prepared: ${needToPrepare.map(({host}) => host).join(', ')}`);
      for (const scheduledHost of needToPrepare) {
        const procedure = getProcedure(ns, scheduledHost);
          procedureQueue.push({
            host: scheduledHost.host,
            procedure,
          });
          scheduledHost.queued = true;
      }

      // Queue new exploit procedures 
      const needToExploit = scheduledHostsArr
        .filter((scheduledHost) => 
          // But not queued (avoid queue depth overload)
          !scheduledHost.queued
          // And after the 'prepare' stage
          && scheduledHost.assignedProcedure === 'exploit');
        if (count % 100 === 0) ns.tprint(`${needToExploit.length} hosts will be exploited: ${needToPrepare.map(({host}) => host).join(', ')}`);
        for (const scheduledHost of needToExploit) {
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
    await writeJson(ns, '/data/controlledHostsMetadata.txt', controlledHostsWithMetadata);
    let totalAvailableRam = controlledHostsWithMetadata.reduce((acc, {availableRam}) => acc + availableRam, 0);
    while(procedureQueue.length > 0) {
      const currentProcedure = procedureQueue.shift() as QueuedProcedure;
      const currentHost = scheduledHosts.get(currentProcedure.host) as ScheduledHost;
      const hostRunningProceduresArr = Array.from(currentHost.runningProcedures.values());
      const expectedEndTimes = hostRunningProceduresArr
        .map(({timeStarted, procedure}) => timeStarted + procedure.totalDuration);
      if (currentProcedure.procedure.totalRamNeeded > totalAvailableRam) {
        procedureQueue.unshift(currentProcedure);
        if(count % 100 === 0) ns.tprint(`WARN: Out of memory, ${procedureQueue.length} items remain in current queue`);
        break;
      } else if (expectedEndTimes.every((time) => time < Date.now() + currentProcedure.procedure.totalDuration + procedureSafetyBufferMs)) {
        const processId = shortId();
        await writePortJson(ns, 7, currentProcedure);
        ns.run('/scheduler/manage-procedure.js', 1, processId, currentProcedure.host);
        totalAvailableRam -= currentProcedure.procedure.totalRamNeeded;
        while(ns.peek(8) === 'NULL PORT DATA') await ns.sleep(30);
        const peek = ns.peek(8);
        ns.print(peek);
        const { processes } = readPortJson(ns, 8) as NewRunningProcesses;
        currentHost.runningProcedures.set(processId, {
          processId,
          processes, 
          timeStarted: Date.now(),
          procedure: currentProcedure.procedure,
        });
        currentHost.queued = false;
        ns.tprint(`
        \tStarted Procedure
        \tHost: ${currentProcedure.host}
        \tType: ${currentHost.assignedProcedure}
        \tExpected Duration: ${currentProcedure.procedure.totalDuration / 1000}s
        \tRam Used: ${currentProcedure.procedure.totalRamNeeded}
        `)
      } else {
        procedureQueue.unshift(currentProcedure);
        // if(count % 100 === 0) ns.tprint(`Not ready to schedule more Procedures for ${currentProcedure.host}.`);
      }
    }

    // Read any running processes out of queue, only the first step will be read from the port when executing above.
    while (ns.peek(8) !== 'NULL PORT DATA') {
      const peek = ns.peek(8);
      ns.print(peek); 
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
    count +=1;
  }
}
