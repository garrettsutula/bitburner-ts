import { NS } from '@ns'
import { disableLogs } from '/lib/logger';
import { ScheduledHost } from '/models/procedure';
import { readJson } from '/lib/file';
import { logger } from '/lib/logger';
import { schedulerParameters, scriptPaths } from '/config';
import { shortId } from '/lib/uuid';
import { execa } from '/lib/exec';
import { getControlledHostsWithMetadata } from '/lib/hosts';

const { tickRate } = schedulerParameters;
const basicHackSize = 2.4;

async function startBasicHack (ns: NS, controlledHosts: string[], scheduledHosts: Map<string, ScheduledHost>) {
  const scheduledHostsArr = Array.from(scheduledHosts.values());

  for (const host of scheduledHostsArr) {
    const controlledHostsWithMetadata = getControlledHostsWithMetadata(ns, controlledHosts);
    const hostToExecute = controlledHostsWithMetadata.find((host) => basicHackSize < host.availableRam);
    if (hostToExecute && scheduledHostsArr.every((scheduledHost) => scheduledHost.runningProcedures.size >= host.runningProcedures.size)) {
          const processId = shortId();
          execa(ns, scriptPaths.basicHack, hostToExecute.host, 1, host.host, processId);
          host.runningProcedures.set(processId, {
            processId,
            processes: [{host: hostToExecute.host, script: scriptPaths.basicHack, args: [host.host, processId]}], 
            timeStarted: Date.now(),
            procedure: {type: 'exploit', steps: [], totalDuration: 0, totalRamNeeded: basicHackSize},
          });
    } else {
      break;
    }

  }
}

function setInitialSchedule(ns: NS, host: string, scheduledHosts: Map<string, ScheduledHost>) {
  if (scheduledHosts.has(host)) return;
    scheduledHosts.set(host, {
      host,
      assignedProcedure: 'exploit',
      runningProcedures: new Map(),
      queued: false,
    })
    return 'exploit';
}

export async function main(ns : NS) : Promise<void> {
  disableLogs(ns);
  
  const scheduledHosts = new Map<string, ScheduledHost>();

  while (true) {
    const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[]
    const exploitableHosts = (readJson(ns, '/data/exploitableHosts.txt') as string[]);
    
    exploitableHosts.forEach((host) => {
      setInitialSchedule(ns, host, scheduledHosts);
    });

    await startBasicHack(ns, controlledHosts, scheduledHosts);

    logger.info(ns, 'schedulerReport', `
    Scheduler Report ${new Date().toLocaleTimeString()}:
    -----------------
    ${Array.from(scheduledHosts.values())
      .map((scheduledHost) => logger.scheduledHostStatus(ns, scheduledHost))
      .join('\n')}`);

    await ns.sleep(tickRate);
  }
}