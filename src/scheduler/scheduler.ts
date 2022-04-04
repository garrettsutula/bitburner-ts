import { NS } from '@ns';
import { readJson, writeJson } from 'lib/file';
import { disableLogs } from 'lib/logs';
import { shortId } from 'lib/uuid';
import { QueuedProcedure, ScheduledHost } from 'models/procedure';
import { ControlledServers } from 'models/server';
import { exploitSchedule } from 'scheduler/stages/exploit';
import { prepareSchedule } from 'scheduler/stages/prepare';
import { scheduleAcrossHosts } from 'lib/process';
import { kill } from 'lib/exec';

const minHomeRamAvailable = 256;
const procedureSafetyBufferMs = 1000 * 1;
const terminalLogInterval = 1000 * 120;
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

function endAllRunningProcedures(ns: NS, scheduledHost: ScheduledHost) {
  scheduledHost.runningProcedures.forEach((runningProcedure) => {
    runningProcedure.processes.forEach(({ script, host, args }) => kill(ns, script, host, args));
  })
  scheduledHost.runningProcedures.clear();
}


export async function main(ns : NS) : Promise<void> {
  disableLogs(ns);
  let procedureLimit = 1;
  const scheduledHosts = new Map<string, ScheduledHost>();

  while (true) {
    // Sleep at the front of the loop so we can 'continue' if the queue is filled already.
    await ns.sleep(100);
    const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[];
    const exploitableHosts = (readJson(ns, '/data/exploitableHosts.txt') as string[]);
    const procedureQueue: QueuedProcedure[] = [];
    
    exploitableHosts.forEach((host) => setInitialSchedule(ns, host, scheduledHosts));
    const scheduledHostsArr = Array.from(scheduledHosts.values());

    // Only attempt to queue new Procedures if our queue depth is shallow.
    if (procedureQueue.length < scheduledHostsArr.length || procedureQueue.length == 0) {
      for (const scheduledHost of scheduledHostsArr) {
        // If needed, move the host to the exploit Procedure now that it is prepared.
        const host = scheduledHost.host;
        const isAlreadyWeakened = ns.getServerSecurityLevel(host) < ns.getServerMinSecurityLevel(host) + 2;
        const isAlreadyGrown = ns.getServerMaxMoney(host) * 0.70 < ns.getServerMoneyAvailable(host);
        if (isAlreadyWeakened && isAlreadyGrown && scheduledHost.assignedProcedure === 'prepare') {
              scheduledHost.assignedProcedure = 'exploit';
              endAllRunningProcedures(ns, scheduledHost);
          ns.tprint(`INFO: ${host} switching from PREPARE to EXPLOIT!`);
        } else if ((!isAlreadyWeakened || !isAlreadyGrown) && scheduledHost.assignedProcedure === 'exploit') {
          ns.tprint(`WARN: ${host} switching from EXPLOIT to PREPARE. Weakened: ${isAlreadyWeakened}, Grown: ${isAlreadyGrown}`);
          scheduledHost.assignedProcedure = 'prepare';
          endAllRunningProcedures(ns, scheduledHost);
        }
  
        // Remove old procedures that have ended
        scheduledHost.runningProcedures.forEach((procedure, key) => {
          if(procedure.timeStarted + procedure.procedure.totalDuration < Date.now()) scheduledHost.runningProcedures.delete(key);
        })
  
        // Queue prepare procedures
        if(scheduledHost.runningProcedures.size < procedureLimit && scheduledHost.assignedProcedure === 'prepare') {
          const procedure = getProcedure(ns, scheduledHost);
          procedureQueue.push({
            host,
            procedure,
          });
        }
        // Queue exploit procedures
        if(scheduledHost.runningProcedures.size < procedureLimit && scheduledHost.assignedProcedure === 'exploit') {
          const procedure = getProcedure(ns, scheduledHost);
          procedureQueue.push({
            host: scheduledHost.host,
            procedure,
          });
        }
      }
    } else {
      const message = 'queue depth at maximum'
      ns.print(message);
      intermittentLog(ns, message, true);
      continue;
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
            ns.print(`INFO: STARTED ${currentHost.assignedProcedure}@${currentProcedure.host}, *** ${(currentProcedure.procedure.totalDuration / 1000).toFixed(0)}s *** ${(currentProcedure.procedure.totalRamNeeded).toFixed(0)}GB Used`);
            totalAvailableRam -= currentProcedure.procedure.totalRamNeeded;
      } else {
        procedureQueue.unshift(currentProcedure);
        break;
      }
    }

    if (scheduledHostsArr.every((scheduledHost) => scheduledHost.runningProcedures.size === procedureLimit)) {
      ns.tprint(`INFO: Procedure limit increased, was ${procedureLimit - 1}, now ${procedureLimit}.`);
      procedureLimit += 1;
    }

    intermittentLog(ns, `INFO:\nScheduler Report ${new Date().toLocaleTimeString()}:\nqueue depth - ${procedureQueue.length}\n-----------------\n${scheduledHostsArr
      .map((scheduledHost) => `* ${scheduledHost.assignedProcedure} - ${scheduledHost.runningProcedures.size} running - ${scheduledHost.host}`)
      .join('\n')}`);
  }
}
