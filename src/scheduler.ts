import { NS } from '@ns';
import { readJson } from '/lib/file';
import { disableLogs } from '/lib/logger';
import { shortId } from '/lib/uuid';
import { QueuedProcedure, ScheduledHost } from '/models/procedure';
import { ControlledServers } from '/models/server';
import { exploitSchedule } from '/lib/stages/exploit';
import { prepareSchedule } from '/lib/stages/prepare';
import { logger } from '/lib/logger';
import { getControlledHostsWithMetadata } from '/lib/hosts';
import { isAlreadyGrown, isAlreadyWeakened } from '/lib/metrics';
import { schedulerParameters } from '/config';
import { execa } from '/lib/exec';

let controlledHostCount = 0;

const { tickRate, executionBufferMs } = schedulerParameters;

function setInitialSchedule(ns: NS, host: string, scheduledHosts: Map<string, ScheduledHost>) {
  if (scheduledHosts.has(host)) return;
  if (isAlreadyGrown(ns, host) && isAlreadyWeakened(ns, host)) {
    scheduledHosts.set(host, {
      host,
      assignedProcedure: 'exploit',
      runningProcedures: new Map(),
      queued: false,
    })
    return 'exploit';
  } else {
    scheduledHosts.set(host, {
      host,
      assignedProcedure: 'prepare',
      runningProcedures: new Map(),
      queued: false,
    })
    return 'prepare';
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

function runProcedure(ns: NS, processId: string, currentProcedure: QueuedProcedure, controlledServer: ControlledServers) {
  const newProcesses = [];
  const {host, procedure: { steps }} = currentProcedure;
  for (const step of steps) {
    execa(ns, step.script, controlledServer.host, step.threadsNeeded, host, step.delay || 0, processId, step.ordinal);
    newProcesses.push({ host: controlledServer.host, script: step.script, args: [ host, step.delay > 0 ? step.delay : 0, processId, step.ordinal ] });
  }
  return newProcesses;
}

async function queueAndExecuteProcedures(ns:NS, controlledHosts: string[], scheduledHosts: Map<string, ScheduledHost>) {
  const procedureQueue: QueuedProcedure[] = [];
  const scheduledHostsArr = Array.from(scheduledHosts.values()).reverse();

  for (const scheduledHost of scheduledHostsArr) {
    const host = scheduledHost.host;

    // Remove old procedures that have ended
    scheduledHost.runningProcedures.forEach((procedure, key) => {
      if(procedure.timeStarted + procedure.procedure.totalDuration < Date.now()) scheduledHost.runningProcedures.delete(key);
    })
    
    // Switch assigned procedure if needed.
    const readyToExploit = isAlreadyWeakened(ns, host) && isAlreadyGrown(ns, host);
    if (readyToExploit) {
      ns.print(`INFO: ${host} switching from PREPARE to EXPLOIT!`);
      scheduledHost.assignedProcedure = 'exploit';
    } else {
      scheduledHost.assignedProcedure = 'prepare';
    }


    const procedure = getProcedure(ns, scheduledHost);
    // Math.floor(procedure.totalDuration / executionBufferMs)
    if (Math.floor(procedure.totalDuration / executionBufferMs) > scheduledHost.runningProcedures.size /* && scheduledHostsArr.every((host) => host.runningProcedures.size >= scheduledHost.runningProcedures.size) */) {
      procedureQueue.push({
        host,
        procedure,
      });
    }
  }
    
  // Execution loop, empty the queue until we OOM
  while (procedureQueue.length > 0) {
    const controlledHostsWithMetadata = getControlledHostsWithMetadata(ns, controlledHosts);
    const currentProcedure = procedureQueue.shift() as QueuedProcedure;
    const currentHost = scheduledHosts.get(currentProcedure.host) as ScheduledHost;
    const hostToExecute = controlledHostsWithMetadata.find((host) => currentProcedure.procedure.totalRamNeeded < host.availableRam);
    if (hostToExecute) {
          const processId = shortId();
          const newProcesses = runProcedure(ns, processId, currentProcedure, hostToExecute);
          currentHost.runningProcedures.set(processId, {
            processId,
            processes: newProcesses, 
            timeStarted: Date.now(),
            procedure: currentProcedure.procedure,
          });
    } else {
      logger.warn(ns, 'outOfMemory', `Out of Memory: was attempting to schedule ${currentProcedure.procedure.type}@${currentProcedure.host}, needed ${currentProcedure.procedure.totalRamNeeded.toFixed(0)}GB RAM. ${procedureQueue.length} remain in queue.`);
      break;
    }
  }
  
}

export async function main(ns : NS) : Promise<void> {
  disableLogs(ns);
  ns.tail();
  
  const scheduledHosts = new Map<string, ScheduledHost>();
  controlledHostCount = 0;

  while (true) {
    await ns.sleep(tickRate);
    const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[]
    const exploitableHosts = (readJson(ns, '/data/exploitableHosts.txt') as string[]);

    // Copy scripts to new hosts before we proceed further to make sure they can run scripts if we try.
    if (controlledHostCount > 0 && controlledHostCount < controlledHosts.length) {
      const newHostsCount = controlledHosts.length - controlledHostCount;
      const newHosts = controlledHosts.slice(controlledHosts.length - newHostsCount);
      newHosts.forEach((host) => execa(ns, 'copy-scripts.js', 'home', 1, host, `${host}-setup-scripts`));
      controlledHostCount = controlledHosts.length;
      await ns.sleep(1000);
    }
    
    exploitableHosts.forEach((host) => {
      setInitialSchedule(ns, host, scheduledHosts);
    });

    await queueAndExecuteProcedures(ns, controlledHosts, scheduledHosts);

    logger.info(ns, 'schedulerReport', `
    Scheduler Report ${new Date().toLocaleTimeString()}:
    -----------------
    ${Array.from(scheduledHosts.values())
      .map((scheduledHost) => logger.scheduledHostStatus(ns, scheduledHost))
      .join('\n')}`);
  }
}
