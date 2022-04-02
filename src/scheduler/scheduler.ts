import { NS } from '@ns';
import { readJson, writeJson } from 'lib/file';
import { disableLogs } from 'lib/logs';
import { clearPort, readPortJson, writePortJson } from '/lib/port';
import { shortId } from '/lib/uuid';
import { QueuedProcedure, ScheduledHost } from '/models/procedure';
import { ControlledServers } from '/models/server';
import { GenericObject } from '/models/utility';
import { exploitSchedule } from '/scheduler/stages/exploit';
import { prepareSchedule } from '/scheduler/stages/prepare';

const minHomeRamAvailable = 32;
const procedureSafetyBufferMs = 1000 * 1;

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
  let count = 1000;
  disableLogs(ns);
  clearPort(ns, 7);
  clearPort(ns, 8);
  clearPort(ns, 9);

  // Load rooted hosts (found, rooted in network) and controlled hosts (home + servers + rooted). 
  const exploitableHosts = (readJson(ns, '/data/exploitableHosts.txt') as string[]).slice(0,10);
  const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[];

  // Set initial schedule for rooted hosts.
  // This doesn't kill or change anything we have running.
  exploitableHosts
  .forEach((host) => {
    const growThreshold = ns.getServerMaxMoney(host) * 0.90;
    const currentMoney = ns.getServerMoneyAvailable(host);
    const isAlreadyWeakened = ns.getServerSecurityLevel(host) < ns.getServerMinSecurityLevel(host) + 2;
    const isAlreadyGrown = growThreshold <= currentMoney;
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
        // No running procedures or fewer than needed to hit threshold.
        (scheduledHost.runningProcedures.size === 0 || (scheduledHost.runningProcedures.size > 0 && ns.getServerMaxMoney(scheduledHost.host) * 0.88 > ns.getServerMoneyAvailable(scheduledHost.host)))
        // Not queued (avoid queue depth overload)
        && !scheduledHost.queued
        // On the 'prepare' stage
        && scheduledHost.assignedProcedure === 'prepare');
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
      const alreadyTriedToRun: QueuedProcedure[] = [];
      const currentProcedure = procedureQueue.shift() as QueuedProcedure;
      const currentHost = scheduledHosts.get(currentProcedure.host) as ScheduledHost;
      const hostRunningProceduresArr = Array.from(currentHost.runningProcedures.values());
      const expectedEndTimes = hostRunningProceduresArr
        .map(({timeStarted, procedure}) => timeStarted + procedure.totalDuration);
      const futureProcedureEstimatedEnd = Date.now() + currentProcedure.procedure.totalDuration + procedureSafetyBufferMs;
      if (currentProcedure.procedure.totalRamNeeded > totalAvailableRam) {
        procedureQueue.push(currentProcedure);
        if (alreadyTriedToRun.includes(currentProcedure)) break;
        alreadyTriedToRun.push(currentProcedure);
        
      } else if (expectedEndTimes.every((time) => time < futureProcedureEstimatedEnd)) {
        const processId = shortId();
        await writePortJson(ns, 7, currentProcedure);
        ns.run('/scheduler/manage-procedure.js', 1, processId, currentProcedure.host);
        totalAvailableRam -= currentProcedure.procedure.totalRamNeeded;
        currentHost.runningProcedures.set(processId, {
          processId,
          processes: [], 
          timeStarted: Date.now(),
          procedure: currentProcedure.procedure,
        });
        currentHost.queued = false;
        ns.print(`
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

    // Read queue signals and update running processes.
    while (ns.peek(9) !== 'NULL PORT DATA') {
      const peekedValue = ns.peek(9);
      const terminatedProcedure = readPortJson(ns, 9) as GenericObject;
      let host, processId;
      if (!terminatedProcedure) {
        const peekedTermination = JSON.parse(peekedValue);
        host = peekedTermination.host;
        processId = peekedTermination.processId;
      } else {
        host = terminatedProcedure.host;
        processId = terminatedProcedure.processId;
      }
      const scheduledHost = scheduledHosts.get(host) as ScheduledHost; 
      scheduledHost.runningProcedures.delete(processId);
      // If needed, move the host to the exploit Procedure now that it is prepared.
      const isAlreadyWeakened = ns.getServerSecurityLevel(host) < ns.getServerMinSecurityLevel(host) + 2;
      const isAlreadyGrown = ns.getServerMaxMoney(host) * 0.90 < ns.getServerMoneyAvailable(host);
      if (isAlreadyWeakened
          && isAlreadyGrown && scheduledHost.assignedProcedure === 'prepare') {
        scheduledHost.assignedProcedure = 'exploit';
        ns.tprint(`${scheduledHost.host} switching from PREPARE to EXPLOIT!`);
      } else if ((!isAlreadyWeakened
        || !isAlreadyGrown) && scheduledHost.assignedProcedure === 'exploit') {
        ns.tprint(`WARN: ${scheduledHost.host} switching from EXPLOIT to PREPARE. Weakened: ${isAlreadyWeakened}, Grown: ${isAlreadyGrown}`);
        scheduledHost.assignedProcedure = 'prepare';
        }
    }
    if (count % 1000 === 0) {
      ns.tprint(`\nScheduler Report:\n${scheduledHostsArr
        .map((scheduledHost) => `${scheduledHost.assignedProcedure} - ${scheduledHost.runningProcedures.size} running - ${scheduledHost.host}`)
        .join('\n')}`);
    } 
    await ns.sleep(100);
    count +=1;
  }
}
