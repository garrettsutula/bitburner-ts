import { NS } from '@ns';
import { readJson } from 'lib/file';
import { disableLogs } from 'lib/logs';
import { scheduleAcrossHosts } from 'lib/process';
import { writePortJson } from '/lib/port';
import { QueuedProcedure, ScheduledHost } from '/models/procedure';
import { ControlledServers } from '/models/server';
import { exploitSchedule } from '/scheduler/stages/exploit';
import { prepareSchedule } from '/scheduler/stages/prepare';

const scriptPaths = {
  touch: '/spider/touch.js',
  hack: '/spider/hack.js',
  grow: '/spider/grow.js',
  weaken: '/spider/weaken.js',
  watchSecurity: '/spider/watch-security.js',
  watchGrowth: '/spider/watch-growth.js',
  watchHack: '/spider/watch-hack.js',
  spider: '/spider/spider.js',
};
const minHomeRamAvailable = 32;

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

async function executeProcedureQueue(procedureQueue: QueuedProcedure[], controlledHosts: string[]) {
  return {procedureQueue, controlledHosts};
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
  disableLogs(ns);
  let count = 1;

  // Load rooted hosts (found, rooted in network) and controlled hosts (home + servers + rooted).
  const rootedHosts = readJson(ns, '/data/rootedHosts.txt') as string[];
  const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[];

  // Set initial schedule for rooted hosts.
  rootedHosts
  .forEach((host) => {
    const currentSecurityLevel = ns.getServerSecurityLevel(host);
    const minSecurityLevel = ns.getServerMinSecurityLevel(host);
    if (currentSecurityLevel > minSecurityLevel + 2) {
      scheduledHosts.set(host, {
        host,
        assignedProcedure: 'prepare',
        runningProcedures: [],
        queued: false,
      })
    } else {
      scheduledHosts.set(host, {
        host,
        assignedProcedure: 'exploit',
        runningProcedures: [],
        queued: false,
      })
    }
  });

  while (true) {
    const scheduledHostsArr = Array.from(scheduledHosts.values());

    // TODO: Probably wrap these in a queue depth measure

    // Queue new procedure for any hosts that don't have one running already.
    const scheduledNotRunning = scheduledHostsArr
      .filter((scheduledHost) => scheduledHost.runningProcedures.length === 0);

    for (const scheduledHost of scheduledNotRunning) {
      const procedure = getProcedure(ns, scheduledHost);
        procedureQueue.push({
          host: scheduledHost.host,
          procedure,
        });
        scheduledHost.queued = true;
    }

    await ns.sleep(100);

    // Queue follow-up exploit procedure for any that are currently running.
    const scheduledAndRunnningExploit = scheduledHostsArr
      .filter((scheduledHost) => 
        scheduledHost.runningProcedures.length
        && !scheduledHost.queued
        && scheduledHost.assignedProcedure === 'exploit');

      for (const scheduledHost of scheduledAndRunnningExploit) {
        const procedure = getProcedure(ns, scheduledHost);
          procedureQueue.push({
            host: scheduledHost.host,
            procedure,
          });
    }

    const controlledHostsWithMetadata = getControlledHostsWithMetadata(ns, controlledHosts);
    const totalAvailableRam = controlledHostsWithMetadata.reduce((acc, {availableRam}) => acc + availableRam, 0);

    for (const queuedProcedure of procedureQueue) {
      if (totalAvailableRam > queuedProcedure.procedure.totalRamNeeded) {
        await writePortJson(ns, 1, queuedProcedure.procedure);
        // send procedure to a port and start a watch-procedure process
        // decrement total available ram by totalRamNeeded
      }
    }


    /*
    if (newHacks.length || newWeakens.length || newGrows.length) {
      ns.tprint(`DISTRIBUTOR
      \tLoop #${count}
      \tRooted Hosts Count: ${rootedHosts.length}
      \t*******************************************
      \t***********  CURRENT TARGETS  *************
      \t*******************************************
      \tCurrent Weaken Targets: ${Array.from(runningProcesses.weakening.keys()).join(', ') || 'n/a'}
      \tCurrent Grow Targets: ${Array.from(runningProcesses.growing.keys()).join(', ') || 'n/a'}
      \tCurrent Hacks Targets: ${Array.from(runningProcesses.hacking.keys()).join(', ') || 'n/a'}
      \t*************  NEW TARGETS  ***************
      \t*******************************************
      \tNew Weaken Targets: ${newWeakens.join(', ') || 'n/a'}
      \tNew Grow Targets: ${newGrows.join(', ') || 'n/a'}
      \tNew Hacks Targets: ${newHacks.join(', ') || 'n/a'}
      \t*******************************************
    `);
    }
    */
    count += 1;

  }
}
