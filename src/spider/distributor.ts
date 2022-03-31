import { NS } from '@ns';
import { shortId } from 'lib/uuid';
import { readJson, writeJson } from 'lib/file';
import { disableLogs } from 'lib/logs';
import { RunningProcesses } from 'models/process';
import { ControlledServers, ServerNotification } from 'models/server';
import { killProcesses, scheduleAcrossHosts } from 'lib/process';
import { Process } from 'models/process';

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

async function recycleDistributor(ns: NS, runningProcesses: RunningProcesses) {
  return writeJson(ns, '/data/distributorState.txt', runningProcesses);
}

async function killHacks(ns: NS, host: string) {
  if (host === 'home') {
    Object.values(scriptPaths).forEach((scriptPath) => {
      ns.scriptKill(scriptPath, 'home');
    })
  } else {
    ns.killall(host);
    await ns.scp(ns.ls('home', '/spider'), 'home', host);
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

async function awaitAndProcessNotifications(ns: NS, notifications: Set<ServerNotification>, runningProcesses: RunningProcesses): Promise<void> {
  let count = 1;
  let recycle = false;
  while (ns.ls('home', '.notification.txt').length === 0 && count < 5) {
    await ns.sleep(5000);
    count += 1;
  }
  ns.ls('home', '.notification.txt').forEach((filePath) => {
    const notification = readJson(ns, filePath) as ServerNotification;
    if (notification.host === 'home' && notification.status === 'recycle') recycle = true;
    notifications.add(notification);
    ns.rm(filePath);
  });
  if (recycle) await recycleDistributor(ns, runningProcesses);
}

function isCurrentTarget(host: string, runningProcesses: RunningProcesses) {
  return runningProcesses.weakening.has(host) || runningProcesses.growing.has(host) || runningProcesses.hacking.has(host);
}

async function hack(ns: NS, host: string, controlledHostsWithMetadata: ControlledServers[]): Promise<Process[]> {
  const serverMaxMoney = ns.getServerMaxMoney(host);
  const serverMoneyAvailable = ns.getServerMoneyAvailable(host);
  const currentSecurityLevel = ns.getServerSecurityLevel(host);
  const minimumSecurityLevel = ns.getServerMinSecurityLevel(host);
  const isBelowMoneyThreshold = serverMoneyAvailable < 0.90 * serverMaxMoney;
  const isAlreadyWeakened = currentSecurityLevel < 3 + minimumSecurityLevel;
  const newProcesses = [];
  if (
    serverMaxMoney > 0
    && !isBelowMoneyThreshold
    && isAlreadyWeakened
  ) {
    const hackAmountNeeded = serverMoneyAvailable - (serverMaxMoney * 0.45);
    const hackThreadsNeeded = Math.ceil(ns.hackAnalyzeThreads(host, hackAmountNeeded)) / 4 || 1;
    const weakenThreadsNeeded = Math.ceil(hackThreadsNeeded / (6 * 4)) || 1;
    const processTag = shortId();

    newProcesses.push(
      ...(await scheduleAcrossHosts(ns, controlledHostsWithMetadata, scriptPaths.hack, hackThreadsNeeded, host, processTag)),
      ...(await scheduleAcrossHosts(ns, controlledHostsWithMetadata, scriptPaths.weaken, weakenThreadsNeeded, host, processTag)),
    );

    if (newProcesses.length) {
      ns.print(`
      *************************
      **** NEW HACK TARGET ****
      \tHost: ${host}
      \tAvailable Money: ${serverMoneyAvailable.toFixed(0)}
      \tExpected Earnings: ${(serverMoneyAvailable) - (serverMaxMoney * 0.45)}
      \tGrow threads needed: ${Math.ceil(hackThreadsNeeded)}
      *************************`);
      await scheduleAcrossHosts(ns, [{ host: 'home', availableRam: 99999 }], scriptPaths.watchHack, 1, host, processTag);
      
    }
  }
  return newProcesses;
}

async function grow(ns: NS, host: string, controlledHostsWithMetadata: ControlledServers[]): Promise<Process[]> {
  const serverMaxMoney = ns.getServerMaxMoney(host);
  const serverMoneyAvailable = ns.getServerMoneyAvailable(host);
  const currentSecurityLevel = ns.getServerSecurityLevel(host);
  const minimumSecurityLevel = ns.getServerMinSecurityLevel(host);
  const isBelowMoneyThreshold = serverMoneyAvailable < 0.90 * serverMaxMoney;
  const isAlreadyWeakened = currentSecurityLevel < 3 + minimumSecurityLevel;
  const newProcesses = [];
  if (
    serverMaxMoney > 0
    && isBelowMoneyThreshold
    && isAlreadyWeakened
  ) {
    const growthAmountNeeded = (serverMaxMoney * 0.90) / serverMoneyAvailable;
    const growThreadsNeeded = Math.ceil(ns.growthAnalyze(host, growthAmountNeeded)) / 4 || 1;
    const weakenThreadsNeeded = Math.ceil(growThreadsNeeded / (6 * 4)) || 1;


    const processTag = shortId();
    newProcesses.push(
      ...await scheduleAcrossHosts(ns, controlledHostsWithMetadata, scriptPaths.grow, growThreadsNeeded, host, processTag),
      ...await scheduleAcrossHosts(ns, controlledHostsWithMetadata, scriptPaths.weaken, weakenThreadsNeeded, host, processTag),
    );
    if (newProcesses.length) {
      ns.print(`
      *************************
      **** NEW GROW TARGET ****
      \tHost: ${host}
      \tAvailable Money: ${serverMoneyAvailable.toFixed(0)}
      \tMax Money: ${serverMaxMoney}
      \tNeed to Grow by: ${((serverMaxMoney * 0.90) / serverMoneyAvailable).toFixed(2)}
      \tGrow threads needed: ${Math.ceil(growThreadsNeeded)}
      \tStarting grow threads: ${Math.ceil(growThreadsNeeded)}
      *************************`);
      await scheduleAcrossHosts(ns, [{ host: 'home', availableRam: 99999 }], scriptPaths.watchGrowth, 1, host, processTag);

    }
  }
  return newProcesses;
}

async function weaken(ns: NS, host: string, controlledHostsWithMetadata: ControlledServers[]): Promise<Process[]> {
  const serverMaxMoney = ns.getServerMaxMoney(host);
  const currentSecurityLevel = ns.getServerSecurityLevel(host);
  const minimumSecurityLevel = ns.getServerMinSecurityLevel(host);
  const isAlreadyWeakened = currentSecurityLevel < 3 + minimumSecurityLevel;
  const newProcesses = [];
  if (
    !isAlreadyWeakened
    && serverMaxMoney > 0
  ) {
    // Spawn tons of weaken processes so it only needs to execute as few iterations as possible.
    const weakenThreadCount = Math.ceil(
      ((currentSecurityLevel - minimumSecurityLevel) / 0.05) / 4
    );
    const processTag = shortId();
    newProcesses.push(
      ...await scheduleAcrossHosts(ns, controlledHostsWithMetadata, scriptPaths.weaken, weakenThreadCount, host, processTag),
    );
    if (newProcesses.length) {
      ns.print(`
      ***************************
      **** NEW WEAKEN TARGET ****
      \tHost: ${host}
      \tCurrent Security Level: ${currentSecurityLevel}
      \tMin Security Level: ${minimumSecurityLevel}
      \tWeaken threads needed: ${weakenThreadCount}
      ***************************`);
      await scheduleAcrossHosts(ns, [{ host: 'home', availableRam: 99999 }], scriptPaths.watchSecurity, 1, host, processTag);
    }
  }
  return newProcesses;
}


export async function main(ns : NS) : Promise<void> {
  const restoreState = ns.args[0];
  // Set by the "watch" scripts, cleared by the distributor.
  const notifications = new Set<ServerNotification>();
  const runningProcesses = restoreState ? readJson(ns, '/data/distributorState.txt') as RunningProcesses : new RunningProcesses();
  ns.rm('/data/distributorState.txt');
  disableLogs(ns);
  let count = 1;
  const includedHostCount = 18;

  let rootedHosts = readJson(ns, '/data/rootedHosts.txt') as string[];
  let controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[];

  for (const host of controlledHosts) {
    await killHacks(ns, host);
  }

  while (true) {
    const newWeakens = [];
    const newGrows = [];
    const newHacks = []

    // Ramp up by slicing the array with an includedHostCount that is incremented by an algorithm below.
    rootedHosts = readJson(ns, '/data/rootedHosts.txt').reverse().slice(0, includedHostCount);
    controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[];

    const controlledHostsWithMetadata = getControlledHostsWithMetadata(ns, controlledHosts);

    if (notifications.size) {
      notifications.forEach(({ host, status }) => {
        let hostRunningProcesses;
        switch (status) {
          case 'weakened':
            hostRunningProcesses = runningProcesses.weakening.get(host);
            runningProcesses.weakening.delete(host);
            break;
          case 'grown':
            hostRunningProcesses = runningProcesses.growing.get(host);
            runningProcesses.growing.delete(host);
            break;
          case 'hacked':
            hostRunningProcesses = runningProcesses.hacking.get(host);
            runningProcesses.hacking.delete(host);
            break;
          default:
            ns.tprint(`Unknown notification status from ${host}: ${status}`);
        }
        if (hostRunningProcesses && hostRunningProcesses.length) {
          killProcesses(ns, hostRunningProcesses);
        }
      });
      notifications.clear();
    }

    if (controlledHostsWithMetadata.length) {
      for (const host of rootedHosts) {
        if(!isCurrentTarget(host, runningProcesses)) {
          const newProcesses = await weaken(ns, host, controlledHostsWithMetadata);
          if(newProcesses.length) {
            runningProcesses.weakening.set(host, newProcesses);
            newWeakens.push(host);
          }
        }
      }
    }

    if (controlledHostsWithMetadata.length) {
      for (const host of rootedHosts) {
        if(!isCurrentTarget(host, runningProcesses)) {
          const newProcesses = await hack(ns, host, controlledHostsWithMetadata);
          if(newProcesses.length) {
            runningProcesses.hacking.set(host, newProcesses);
            newHacks.push(host);
          }
        }
      }
    }

    if (controlledHostsWithMetadata.length) {
      for (const host of rootedHosts) {
        if(!isCurrentTarget(host, runningProcesses)) {
          const newProcesses = await grow(ns, host, controlledHostsWithMetadata);
          if(newProcesses.length) {
            runningProcesses.growing.set(host, newProcesses);
            newGrows.push(host);
          }
        }
      }
    }

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
    count += 1;
    await awaitAndProcessNotifications(ns, notifications, runningProcesses);
  }
}
