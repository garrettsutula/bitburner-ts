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
import { randomArrayShuffle } from '/lib/array';
import { logger } from '/lib/logger';
import { getControlledHostsWithMetadata } from '/lib/hosts';
import { isAlreadyGrown, isAlreadyWeakened } from '/lib/metrics';

const queueAndExecutesPerLoop = 10;

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

function endAllRunningProcedures(ns: NS, scheduledHost: ScheduledHost) {
  scheduledHost.runningProcedures.forEach((runningProcedure) => {
    runningProcedure.processes.forEach(({ script, host, args }) => kill(ns, script, host, args));
  })
  scheduledHost.runningProcedures.clear();
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


    // Queue prepare procedures
    if(scheduledHost.assignedProcedure === 'prepare') {
      const procedure = getProcedure(ns, scheduledHost);
      procedureQueue.push({
        host,
        procedure,
      });
    }
    // Queue exploit procedures
    if(scheduledHost.assignedProcedure === 'exploit') {
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
          ns.print(`INFO: STARTED ${currentHost.assignedProcedure}@${currentProcedure.host}, *** ${(currentProcedure.procedure.totalDuration / 1000).toFixed(0)}s *** ${(currentProcedure.procedure.totalRamNeeded).toFixed(0)}GB Used`);
          totalAvailableRam -= currentProcedure.procedure.totalRamNeeded;
    } else {
      procedureQueue.unshift(currentProcedure);
      break;
    }
  }

  if (procedureQueue.length === 0 && controlledHostsWithMetadata.length > 1 && queueAndExecutesPerLoop < 10) { 
    await queueAndExecuteProcedures(ns, controlledHosts, scheduledHosts, count + 1);
  }
}

export async function main(ns : NS) : Promise<void> {
  disableLogs(ns);
  
  const scheduledHosts = new Map<string, ScheduledHost>();

  while (true) {
    // Sleep at the front of the loop so we can 'continue' if the queue is filled already.
    await ns.sleep(30);
    const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[]
    const exploitableHosts = randomArrayShuffle((readJson(ns, '/data/exploitableHosts.txt') as string[]).reverse());
    
    exploitableHosts.forEach((host) => setInitialSchedule(ns, host, scheduledHosts));

    await queueAndExecuteProcedures(ns, controlledHosts, scheduledHosts);

    logger.info(ns, 'schedulerReport', `\nScheduler Report ${new Date().toLocaleTimeString()}:\n-----------------\n${Array.from(scheduledHosts.values())
      .map((scheduledHost) => `* ${scheduledHost.assignedProcedure} - ${scheduledHost.runningProcedures.size} running - ${scheduledHost.host}`)
      .join('\n')}`);
  }
}
