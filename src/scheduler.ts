import { NS } from '@ns';
import { readJson } from 'lib/file';
import { disableLogs } from 'lib/logger';
import { shortId } from 'lib/uuid';
import { QueuedProcedure, ScheduledHost } from 'models/procedure';
import { ControlledServers } from 'models/server';
import { exploitSchedule } from 'lib/stages/exploit';
import { prepareSchedule } from '/lib/stages/prepare';
import { logger } from 'lib/logger';
import { getControlledHostsWithMetadata } from 'lib/hosts';
import { isAlreadyGrown, isAlreadyWeakened, percentMaxMoney, percentOverMinSecurity, percentMaxMoneyNum } from 'lib/metrics';
import { schedulerParameters } from 'config';
import { execa, kill } from 'lib/exec';
import { writePortJson } from 'lib/port';
import asTable from '/lib/ascii-table.js';
import { weakenSchedule } from '/lib/stages/weaken';

let controlledHostCount = 0;
let monitoredHost: string | undefined = undefined;

const { tickRate, executionBufferMs } = schedulerParameters;

function setInitialSchedule(ns: NS, host: string, scheduledHosts: Map<string, ScheduledHost>) {
  if (scheduledHosts.has(host)) return;
  const alreadyWeakened = isAlreadyWeakened(ns, host);
  const alreadyGrown = isAlreadyGrown(ns, host);
  if (alreadyWeakened && alreadyGrown) {
    scheduledHosts.set(host, {
      host,
      assignedProcedure: 'exploit',
      runningProcedures: [],
      queued: false,
    })
    return 'exploit';
  } else if(alreadyWeakened) {
    scheduledHosts.set(host, {
      host,
      assignedProcedure: 'prepare',
      runningProcedures: [],
      queued: false,
    })
    return 'prepare';
  } else {
    scheduledHosts.set(host, {
      host,
      assignedProcedure: 'weaken',
      runningProcedures: [],
      queued: false,
    })
    return 'weaken';
  }
}

function getProcedure(ns: NS, {host, assignedProcedure}: ScheduledHost) {
  switch(assignedProcedure) {
    case 'weaken':
      return weakenSchedule(ns, host);
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
    newProcesses.push({ host: controlledServer.host, script: step.script, args: [  host, step.delay || 0, processId, batchId, host === monitoredHost ? 'monitor' : false ] });
  }
  return newProcesses;
}

async function queueAndExecuteProcedures(ns:NS, controlledHosts: string[], scheduledHosts: Map<string, ScheduledHost>) {
  const procedureQueue: QueuedProcedure[] = [];
  const scheduledHostsArr = Array.from(scheduledHosts.values());

  for (const scheduledHost of scheduledHostsArr) {
    const host = scheduledHost.host;

    // Remove old procedures that have ended
    scheduledHost.runningProcedures = scheduledHost.runningProcedures.filter((procedure) =>  procedure.startTime + procedure.procedure.totalDuration > Date.now());
    
    // Switch assigned procedure if needed.
    const readyToExploit = isAlreadyWeakened(ns, host) && isAlreadyGrown(ns, host);
    const readyToGrow = isAlreadyWeakened(ns, host) && !isAlreadyGrown(ns, host);
    if (readyToExploit && scheduledHost.assignedProcedure === 'prepare') {
      ns.print(`INFO: ${host} switching from PREPARE to EXPLOIT!`);
      scheduledHost.assignedProcedure = 'exploit';
    } else if (readyToGrow && scheduledHost.assignedProcedure === 'weaken') {
      ns.print(`INFO: ${host} switching from WEAKEN to PREPARE!`);
      scheduledHost.assignedProcedure = 'prepare';
    }

    // If the server appears to be draining, cancel the next hack
    if (scheduledHost.assignedProcedure === 'exploit' && ( percentMaxMoneyNum(ns, scheduledHost.host) < 0.70 || !isAlreadyWeakened(ns, scheduledHost.host))) {
      const hackProcess = scheduledHost.runningProcedures[0]?.processes.find((process) => process.script.includes('hack'));
      if (hackProcess) {
        kill(ns, hackProcess.host, hackProcess.script, hackProcess.args);
        await writePortJson(ns, 4, {
          batchId: hackProcess.args[3],
          processId: hackProcess.args[2],
          endTimeActual: Date.now(),
        });
      }
    } 


    const procedure = getProcedure(ns, scheduledHost);
    const lastStartedProcedure = scheduledHost.runningProcedures[scheduledHost.runningProcedures.length - 1];

    const belowMaxRunningInWindow = Math.ceil(procedure.totalDuration / executionBufferMs) > scheduledHost.runningProcedures.length;
    const outsideExecutionBuffer = lastStartedProcedure ? (Date.now() + procedure.totalDuration) > (lastStartedProcedure.startTime + lastStartedProcedure.procedure.totalDuration + executionBufferMs) : true;
    const fewerRunningThanEveryOtherHost = scheduledHost.runningProcedures.length === 0 || scheduledHostsArr.every((host) => scheduledHost.runningProcedures.length < host.runningProcedures.length * 4);
    const lotsOfRamAvailable = false;
    if ((belowMaxRunningInWindow && outsideExecutionBuffer) && (fewerRunningThanEveryOtherHost || lotsOfRamAvailable)) {
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
  const [monitor] = ns.args as string[];
  disableLogs(ns);
  
  const scheduledHosts = new Map<string, ScheduledHost>();
  monitoredHost = (readJson(ns, '/data/monitoredHost.txt') as string[])[0];
  if (monitoredHost && monitor) execa(ns, 'batchMonitor.js', 'home', 1);
  controlledHostCount = 0;
  execa(ns, 'kill-all.js', 'home', 1);

  while (true) {
    await ns.sleep(tickRate);
    const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[]
    const exploitableHosts = (readJson(ns, '/data/exploitableHosts.txt') as string[]);
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

    const title = `Scheduler Report - ${new Date().toLocaleTimeString()}`;
    const reportTable = Array.from(scheduledHosts.values()).map(({host, assignedProcedure: procedure, runningProcedures }) => {
      return {host, procedure, '# running': runningProcedures.length, 'max. money %': percentMaxMoney(ns, host), '% > min. sec.': percentOverMinSecurity(ns, host)}
    });
    logger.info(ns, 'schedulerReport', `\n${title}\n${asTable.configure({delimiter: ' | '})(reportTable)}`);
  }
}
