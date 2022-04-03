import { NS } from '@ns';
import { readJson, writeJson } from 'lib/file';
import { disableLogs } from 'lib/logs';
import { shortId } from '/lib/uuid';
import { QueuedProcedure, ScheduledHost } from '/models/procedure';
import { ControlledServers } from '/models/server';
import { exploitSchedule } from '/scheduler/stages/exploit';
import { prepareSchedule } from '/scheduler/stages/prepare';
import { scheduleAcrossHosts } from '/lib/process';

const minHomeRamAvailable = 256;
const procedureSafetyBufferMs = 1000 * 1;
const terminalLogInterval = 1000 * 15;
const terminalErrorInterval = 1000 * 5;
let lastLogToTerminal = Date.now() - terminalLogInterval; // Subtract a minute
let lastErrorToTerminal = Date.now() - terminalLogInterval; // Subtract a minute

function intermittentLog(ns: NS, message: string, error = false) {
  if (error && lastErrorToTerminal + terminalErrorInterval < Date.now()) {
    ns.tprint(message);
    lastErrorToTerminal = Date.now();
  } else if ( lastLogToTerminal + terminalLogInterval < Date.now()) {
    ns.tprint(message);
    lastLogToTerminal = Date.now();
  }
}

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

function setInitialSchedule(ns: NS, host: string, scheduledHosts: Map<string, ScheduledHost>) {
  if (scheduledHosts.has(host)) return;
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

async function runProcedure(ns: NS, processId: string, currentProcedure: QueuedProcedure, controlledHosts: ControlledServers[]) {
  const newProcesses = [];
  const {host, procedure: { steps }} = currentProcedure;
  for (const step of steps) {    
    newProcesses.push(...(await scheduleAcrossHosts(ns, controlledHosts, step.script, step.threadsNeeded, host, step.delay || 0, processId)));
    await writeJson(ns, '/data/controlledHostsMetadata.txt', controlledHosts);
  }
  return newProcesses;
}


export async function main(ns : NS) : Promise<void> {
  disableLogs(ns);
  const scheduledHosts = new Map<string, ScheduledHost>();

  while (true) {
    // Sleep at the front of the loop so we can 'continue' if the queue is filled already.
    await ns.sleep(100);
    const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[];
    const exploitableHosts = (readJson(ns, '/data/exploitableHosts.txt') as string[]).reverse();
    const procedureQueue: QueuedProcedure[] = [];
    
    exploitableHosts.forEach((host) => setInitialSchedule(ns, host, scheduledHosts));
    const scheduledHostsArr = Array.from(scheduledHosts.values());

    // Only attempt to queue new Procedures if our queue depth is shallow.
    if (procedureQueue.length >= scheduledHostsArr.length && scheduledHostsArr.length > 0) {
      const message = 'queue depth at maximum'
      ns.print(message);
      intermittentLog(ns, message, true);
      continue;
    }
    for (const scheduledHost of scheduledHostsArr) {
      // If needed, move the host to the exploit Procedure now that it is prepared.
      const host = scheduledHost.host;
      const isAlreadyWeakened = ns.getServerSecurityLevel(host) < ns.getServerMinSecurityLevel(host) + 2;
      const isAlreadyGrown = ns.getServerMaxMoney(host) * 0.90 < ns.getServerMoneyAvailable(host);
      if (isAlreadyWeakened && isAlreadyGrown && scheduledHost.assignedProcedure === 'prepare') {
            scheduledHost.assignedProcedure = 'exploit';
        ns.tprint(`${host} switching from PREPARE to EXPLOIT!`);
      } else if ((!isAlreadyWeakened || !isAlreadyGrown) && scheduledHost.assignedProcedure === 'exploit') {
        ns.tprint(`WARN: ${host} switching from EXPLOIT to PREPARE. Weakened: ${isAlreadyWeakened}, Grown: ${isAlreadyGrown}`);
        scheduledHost.assignedProcedure = 'prepare';
      }
      // Remove old procedures
      scheduledHost.runningProcedures.forEach((procedure, key) => {
        if(procedure.timeStarted + procedure.procedure.totalDuration < Date.now()) scheduledHost.runningProcedures.delete(key);
      })

      // Queue prepare procedures
      if(scheduledHost.assignedProcedure === 'prepare') {
        const procedure = getProcedure(ns, scheduledHost);
        procedureQueue.push({
          host,
          procedure,
        });
      }
      // Queue exploit procedures
      if(scheduledHost.runningProcedures.size < 10 && scheduledHost.assignedProcedure === 'exploit') {
        const procedure = getProcedure(ns, scheduledHost);
        procedureQueue.push({
          host: scheduledHost.host,
          procedure,
        });
      }
    }

    // Execution loop, empty the queue until we OOM
    const controlledHostsWithMetadata = getControlledHostsWithMetadata(ns, controlledHosts);
    let totalAvailableRam = controlledHostsWithMetadata.reduce((acc, {availableRam}) => acc + availableRam, 0);
    while (procedureQueue.length > 0) {
      const currentProcedure = procedureQueue.shift() as QueuedProcedure;
      const currentHost = scheduledHosts.get(currentProcedure.host) as ScheduledHost;
      const hostRunningProceduresArr = Array.from(currentHost.runningProcedures.values());
      const expectedEndTimes = hostRunningProceduresArr
        .map(({timeStarted, procedure}) => timeStarted + procedure.totalDuration);
      const futureProcedureEstimatedEnd = Date.now() + currentProcedure.procedure.totalDuration + procedureSafetyBufferMs;
      if (currentProcedure.procedure.totalRamNeeded < totalAvailableRam
          && expectedEndTimes.every((time) => time < futureProcedureEstimatedEnd)) {
            const processId = shortId();
            const newProcesses = await runProcedure(ns, processId, currentProcedure, controlledHostsWithMetadata);
            currentHost.runningProcedures.set(processId, {
              processId,
              processes: newProcesses, 
              timeStarted: Date.now(),
              procedure: currentProcedure.procedure,
            });
            ns.print(`Started: ${currentHost.assignedProcedure}@${currentProcedure.host} - ${(currentProcedure.procedure.totalDuration / 1000).toFixed(0)}s, ${(currentProcedure.procedure.totalRamNeeded).toFixed(0)}GB Used`);
            totalAvailableRam -= currentProcedure.procedure.totalRamNeeded;
      } else {
        procedureQueue.unshift(currentProcedure);
        break;
      }
    }

    intermittentLog(ns, `\nScheduler Report ${new Date().toLocaleTimeString()}:\nqueue depth - ${procedureQueue.length}\n-----------------\n${scheduledHostsArr
      .map((scheduledHost) => `* ${scheduledHost.assignedProcedure} - ${scheduledHost.runningProcedures.size} running - ${scheduledHost.host}`)
      .join('\n')}`);
  }
}
