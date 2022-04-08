import { NS } from '@ns';
import { readJson } from 'lib/file';
import { disableLogs } from 'lib/logs';
import { shortId } from 'lib/uuid';
import { QueuedProcedure, ScheduledHost } from 'models/procedure';
import { ControlledServers } from 'models/server';
import { exploitSchedule } from 'scheduler/stages/exploit';
import { prepareSchedule } from 'scheduler/stages/prepare';
import { scheduleAcrossHosts } from 'lib/process';
import { logger } from '/lib/logger';
import { getControlledHostsWithMetadata } from '/lib/hosts';
import { isAlreadyGrown, isAlreadyWeakened} from '/lib/metrics';
import { schedulerParameters, calculationParameters } from '/scheduler/config';
let currentAttackLimit = 1;

const { tickRate, queueAndExecutesPerTick, baseAttackLimit, executionBufferMs, respectAttackLimit } = schedulerParameters;
const { prepareGrowPercentage } = calculationParameters;

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

async function runProcedure(ns: NS, processId: string, currentProcedure: QueuedProcedure, controlledHosts: ControlledServers[]) {
  const newProcesses = [];
  const {host, procedure: { steps }} = currentProcedure;
  for (const step of steps) {    
    newProcesses.push(...(await scheduleAcrossHosts(ns, controlledHosts, step.script, step.threadsNeeded, host, step.delay || 0, processId, step.ordinal)));
  }
  return newProcesses;
}

async function queueAndExecuteProcedures(ns:NS, controlledHosts: string[], scheduledHosts: Map<string, ScheduledHost>, count = 1) {
  const procedureQueue: QueuedProcedure[] = [];
  const scheduledHostsArr = Array.from(scheduledHosts.values());

  for (const scheduledHost of scheduledHostsArr) {
    const host = scheduledHost.host;

    // Remove old procedures that have ended
    scheduledHost.runningProcedures.forEach((procedure, key) => {
      if(procedure.timeStarted + procedure.procedure.totalDuration < Date.now()) scheduledHost.runningProcedures.delete(key);
    })
    
    // Switch assigned procedure if needed.
    const readyToExploit = isAlreadyWeakened(ns, host) && isAlreadyGrown(ns, host) && scheduledHost.assignedProcedure === 'prepare';
    if (readyToExploit) {
      ns.print(`INFO: ${host} switching from PREPARE to EXPLOIT!`);
      scheduledHost.assignedProcedure = 'exploit';
      currentAttackLimit += 1;
    }

    const runningProcedures = Array.from(scheduledHost.runningProcedures.values());
    const lastEndingProcedure = runningProcedures[runningProcedures.length - 1];
    const lastEndingTime = lastEndingProcedure ? lastEndingProcedure.timeStarted + lastEndingProcedure.procedure.totalDuration : 0;

    const procedure = getProcedure(ns, scheduledHost);
    if (lastEndingTime + executionBufferMs < Date.now() + procedure.totalDuration) {
      if (scheduledHost.assignedProcedure === 'prepare' && scheduledHost.runningProcedures.size < Math.ceil(1/prepareGrowPercentage)) {
        procedureQueue.push({
          host,
          procedure,
        });
      } else if (scheduledHost.assignedProcedure === 'exploit') {
        procedureQueue.push({
          host,
          procedure,
        });
      }
    }


  }
    
  // Execution loop, empty the queue until we OOM
  const controlledHostsWithMetadata = getControlledHostsWithMetadata(ns, controlledHosts);
  let totalAvailableRam = controlledHostsWithMetadata.reduce((acc, {availableRam}) => acc + availableRam, 0);
  while (procedureQueue.length > 0) {
    const currentProcedure = procedureQueue.shift() as QueuedProcedure;
    const currentHost = scheduledHosts.get(currentProcedure.host) as ScheduledHost;
    if (currentProcedure.procedure.totalRamNeeded < totalAvailableRam) {
          const processId = shortId();
          const newProcesses = await runProcedure(ns, processId, currentProcedure, controlledHostsWithMetadata);
          currentHost.runningProcedures.set(processId, {
            processId,
            processes: newProcesses, 
            timeStarted: Date.now(),
            procedure: currentProcedure.procedure,
          });
          totalAvailableRam -= currentProcedure.procedure.totalRamNeeded;
    } else {
      procedureQueue.unshift(currentProcedure);
      logger.warn(ns, 'outOfMemory', `Out of Memory: was attempting to schedule ${procedureQueue[0].procedure.type}@${procedureQueue[0].host}, needed ${procedureQueue[0].procedure.totalRamNeeded.toFixed(0)}GB RAM. ${procedureQueue.length} remain in queue.`);
      break;
    }
  }
  
  if (procedureQueue.length === 0 && controlledHostsWithMetadata.length > 1 && count < queueAndExecutesPerTick) { 
    await queueAndExecuteProcedures(ns, controlledHosts, scheduledHosts, count + 1);
  }
  
  const hostsCurrentlyExploiting = scheduledHostsArr.filter((host) => host.assignedProcedure === 'exploit').length;
  if (hostsCurrentlyExploiting > currentAttackLimit) {
    currentAttackLimit = hostsCurrentlyExploiting;
  }

}

export async function main(ns : NS) : Promise<void> {
  disableLogs(ns);
  currentAttackLimit = baseAttackLimit;
  
  const scheduledHosts = new Map<string, ScheduledHost>();

  while (true) {

    // Sleep at the front of the loop so we can 'continue' if the queue is filled already.
    await ns.sleep(tickRate);
    const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[]
    const exploitableHosts = (readJson(ns, '/data/exploitableHosts.txt') as string[]) //.splice(0, respectAttackLimit ? currentAttackLimit : 9999);
    
    exploitableHosts.forEach((host) => {
      const procedure = setInitialSchedule(ns, host, scheduledHosts);
      if(procedure === 'exploit') currentAttackLimit += 1;
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
