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
import { isAlreadyGrown, isAlreadyWeakened, percentWeakened } from '/lib/metrics';

let queueAndExecutesPerLoop = 0;

function setInitialSchedule(ns: NS, host: string, scheduledHosts: Map<string, ScheduledHost>) {
  if (scheduledHosts.has(host)) return;
  if (isAlreadyGrown(ns, host) && isAlreadyWeakened(ns, host)) {
    scheduledHosts.set(host, {
      host,
      assignedProcedure: 'exploit',
      runningProcedures: new Map(),
      queued: false,
    })

  } else {
    scheduledHosts.set(host, {
      host,
      assignedProcedure: 'prepare',
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
    
    const runningProcedures = Array.from(scheduledHost.runningProcedures.values());
    const nextEndingProcedure = runningProcedures[0] || { timeStarted: 0, procedure: { totalDuration: 0 } };
    const nextEndingTime = nextEndingProcedure.timeStarted + nextEndingProcedure.procedure.totalDuration;
    // Switch assigned procedure if needed.
    const readyToExploit = isAlreadyWeakened(ns, host) && isAlreadyGrown(ns, host);
    if (readyToExploit) {
      ns.print(`INFO: ${host} switching from PREPARE to EXPLOIT!`);
      scheduledHost.assignedProcedure = 'exploit';
    } else if(Date.now() < nextEndingTime) {
      ns.print(`WARN: ${host} switching from EXPLOIT to PREPARE.`);
      scheduledHost.assignedProcedure = 'prepare';
    }


    // Queue prepare procedures, only queue if this procedure has the same or fewer running procedures running than every other one.
    if(scheduledHost.assignedProcedure === 'prepare' && scheduledHostsArr.every((compareHost) => scheduledHost.runningProcedures.size <= compareHost.runningProcedures.size)) {
      const procedure = getProcedure(ns, scheduledHost);
      procedureQueue.push({
        host,
        procedure,
      });
    }
    // Queue prepare procedures, only queue if this procedure has the same or fewer running procedures running than every other one.
    if(scheduledHost.assignedProcedure === 'exploit' && scheduledHostsArr.every((compareHost) => scheduledHost.runningProcedures.size <= compareHost.runningProcedures.size)) {
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

  if (procedureQueue.length === 0 && controlledHostsWithMetadata.length > 1 && count < 10) { 
    logger.info(ns, 'executeLoopIncrease', `Increasing execute loops per tick because we have remaining RAM after all ${queueAndExecutesPerLoop} current loops.`,);
    queueAndExecutesPerLoop += 1;
    await queueAndExecuteProcedures(ns, controlledHosts, scheduledHosts, count + 1);
  }
}

export async function main(ns : NS) : Promise<void> {
  disableLogs(ns);
  queueAndExecutesPerLoop = 1;
  
  const scheduledHosts = new Map<string, ScheduledHost>();

  while (true) {

    // Sleep at the front of the loop so we can 'continue' if the queue is filled already.
    await ns.sleep(30);
    const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[]
    const exploitableHosts = (readJson(ns, '/data/exploitableHosts.txt') as string[]).slice(0,3);
    
    exploitableHosts.forEach((host) => setInitialSchedule(ns, host, scheduledHosts));

    await queueAndExecuteProcedures(ns, controlledHosts, scheduledHosts);

    logger.info(ns, 'schedulerReport', `\nScheduler Report ${new Date().toLocaleTimeString()}:\n-----------------\n${Array.from(scheduledHosts.values())
      .map((scheduledHost) => `* ${scheduledHost.assignedProcedure} - ${scheduledHost.runningProcedures.size} running - ${scheduledHost.host}${scheduledHost.assignedProcedure === 'prepare' ? ` ${percentWeakened(ns, scheduledHost.host)}% progress`: ''}`)
      .join('\n')}`);
  }
}
