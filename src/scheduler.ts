import { NS } from '@ns';
import { readJson } from 'lib/file';
import { disableLogs } from 'lib/logger';
import { shortId } from 'lib/uuid';
import { QueuedProcedure, ScheduledHost } from 'models/procedure';
import { ControlledServers } from 'models/server';
import { exploitSchedule } from 'lib/stages/exploit';
import { prepareSchedule } from 'lib/stages/prepare';
import { logger } from 'lib/logger';
import { getControlledHostsWithMetadata } from 'lib/hosts';
import { isAlreadyGrown, isAlreadyWeakened } from 'lib/metrics';
import { schedulerParameters } from 'config';
import { execa } from 'lib/exec';
import { writePortJson } from 'lib/port';

let controlledHostCount = 0;
let monitoredHost: string | undefined = undefined;

const { tickRate, executionBufferMs } = schedulerParameters;

function setInitialSchedule(ns: NS, host: string, scheduledHosts: Map<string, ScheduledHost>) {
  if (scheduledHosts.has(host)) return;
  if (isAlreadyGrown(ns, host) && isAlreadyWeakened(ns, host)) {
    scheduledHosts.set(host, {
      host,
      assignedProcedure: 'exploit',
      runningProcedures: [],
      queued: false,
    })
    return 'exploit';
  } else {
    scheduledHosts.set(host, {
      host,
      assignedProcedure: 'prepare',
      runningProcedures: [],
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

async function runProcedure(ns: NS, currentProcedure: QueuedProcedure, controlledServer: ControlledServers) {
  const batchId = shortId();
  const newProcesses = [];
  const {host, procedure: { steps }} = currentProcedure;
  for (const step of steps) {
    const processId = shortId();
    if (host === monitoredHost) await writePortJson(ns, 1, {
      batchId,
      processId,
      task: step.task,
      duration: step.duration,
      startTime: Date.now() + step.delay,
      endTime: Date.now() + step.duration + step.delay,
    });
    execa(ns, step.script, controlledServer.host, step.threadsNeeded, host, step.delay || 0, processId, batchId, host === monitoredHost ? 'monitor' : false);
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
    scheduledHost.runningProcedures = scheduledHost.runningProcedures.filter((procedure) =>  procedure.startTime + procedure.procedure.totalDuration > Date.now());
    
    // Switch assigned procedure if needed.
    const readyToExploit = isAlreadyWeakened(ns, host) && isAlreadyGrown(ns, host);
    if (readyToExploit && scheduledHost.assignedProcedure === 'prepare') {
      ns.print(`INFO: ${host} switching from PREPARE to EXPLOIT!`);
      scheduledHost.assignedProcedure = 'exploit';
    }


    const procedure = getProcedure(ns, scheduledHost);
    // Math.floor(procedure.totalDuration / executionBufferMs)
    if (
      Math.floor(procedure.totalDuration / executionBufferMs) > scheduledHost.runningProcedures.length && // We can fit more procedures in the time it takes it execute one divided by the execution buffer.
      scheduledHostsArr.every((host) => host.runningProcedures.length >= scheduledHost.runningProcedures.length || (host.runningProcedures.length && (host.runningProcedures[host.runningProcedures.length - 1].procedure.totalDuration / executionBufferMs) <= scheduledHost.runningProcedures.length ))) {
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
          const newProcesses = await runProcedure(ns, currentProcedure, hostToExecute);
          currentHost.runningProcedures.push({
            processes: newProcesses, 
            startTime: Date.now(),
            procedure: currentProcedure.procedure
          });
    } else {
      logger.warn(ns, 'outOfMemory', `Out of Memory: was attempting to schedule ${currentProcedure.procedure.type}@${currentProcedure.host}, needed ${currentProcedure.procedure.totalRamNeeded.toFixed(0)}GB RAM. ${procedureQueue.length} remain in queue.`);
      break;
    }
  }
  
}

export async function main(ns : NS) : Promise<void> {
  disableLogs(ns);
  
  const scheduledHosts = new Map<string, ScheduledHost>();
  monitoredHost = (readJson(ns, '/data/monitoredHost.txt') as string[])[0];
  if (monitoredHost) execa(ns, 'batchMonitor.js', 'home', 1);
  controlledHostCount = 0;

  while (true) {
    await ns.sleep(tickRate);
    const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[]
    const exploitableHosts = (readJson(ns, '/data/exploitableHosts.txt') as string[]).reverse();
    monitoredHost = (readJson(ns, '/data/monitoredHost.txt') as string[])[0];

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
