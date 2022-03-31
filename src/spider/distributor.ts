import { NS } from '@ns';
import { shortId } from 'lib/uuid';
import { readJson } from 'lib/file';
import { disableLogs } from 'lib/logs';
import { HostProcesses, RunningProcesses } from 'models/process';
import { ControlledServers } from 'models/server';
import { killProcesses, scheduleAcrossHosts } from 'lib/process';

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

async function killHacks(ns: NS, host: string) {
  if (host === 'home') {
    Object.values(scriptPaths).forEach((scriptPath) => {
      ns.scriptKill(scriptPath, home);
    })
  } else {
    ns.killall(host);
    await ns.scp(ns.ls('home', '/spider'), 'home', host);
    await ns.scp(ns.ls('home', '/utils'), 'home', host);
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

async function awaitAndProcessNotifications(ns: NS, notifications: Set<string>): Promise<void> {
  let count = 1;
  while (ns.ls('home', '.notification.txt').length === 0 && count < 5) {
    await ns.sleep(5000);
    count += 1;
  }
  ns.ls('home', '.notification.txt').forEach((filePath) => {
    notifications.add(readJson(filePath));
    ns.rm(filePath);
  });
}

function isCurrentTarget(host: string, runningProcesses: RunningProcesses) {
  return runningProcesses.weakening.has(host) || runningProcesses.growing.has(host) || runningProcesses.hacking.has(host);
}

async function hack(ns: NS, host: string, controlledHostsWithMetadata: ControlledServers): Promise<HostProcesses> {
  const serverMaxMoney = ns.getServerMaxMoney(host);
  const serverMoneyAvailable = ns.getServerMoneyAvailable(host);
  const currentSecurityLevel = ns.getServerSecurityLevel(host);
  const minimumSecurityLevel = ns.getServerMinSecurityLevel(host);
  const isBelowMoneyThreshold = serverMoneyAvailable < 0.90 * serverMaxMoney;
  const isAlreadyWeakened = currentSecurityLevel < 3 + minimumSecurityLevel;
  if (
    serverMaxMoney > 0
    && !isBelowMoneyThreshold
    && isAlreadyWeakened
  ) {
    const newProcesses = [];
    for (let i = 0; controlledHostsWithMetadata.length > 0 && i < 5; i += 1) {
      const processTag = shortId();
      await ns.sleep(30);
      newProcesses.push(
        ...(await scheduleAcrossHosts(ns, controlledHostsWithMetadata, scriptPaths.hack, 6, host, processTag)),
        ...(await scheduleAcrossHosts(ns, controlledHostsWithMetadata, scriptPaths.weaken, 1, host, processTag)),
      );
    }
    if (newProcesses.length) {
      ns.print(`
      *************************
      **** NEW HACK TARGET ****
      \tHost: ${host}
      \tAvailable Money: ${serverMoneyAvailable.toFixed(0)}
      \tExpected Earnings: ${(serverMaxMoney * 0.6) - (serverMaxMoney * 0.5)}
      *************************`);
      await scheduleAcrossHosts(ns, [{ host: 'home', availableRam: 99999 }], scriptPaths.watchHack, 1, host, 'hack-stage');
      return newProcesses;
    }
  }
}

async function grow(ns: NS, host: string, controlledHostsWithMetadata: ControlledServers): Promise<HostProcesses> {
  const serverMaxMoney = ns.getServerMaxMoney(host);
  const serverMoneyAvailable = ns.getServerMoneyAvailable(host);
  const currentSecurityLevel = ns.getServerSecurityLevel(host);
  const minimumSecurityLevel = ns.getServerMinSecurityLevel(host);
  const isBelowMoneyThreshold = serverMoneyAvailable < 0.90 * serverMaxMoney;
  const isAlreadyWeakened = currentSecurityLevel < 3 + minimumSecurityLevel;
  if (
    serverMaxMoney > 0
    && isBelowMoneyThreshold
    && isAlreadyWeakened
  ) {
    const growthAmountNeeded = (serverMaxMoney * 0.90) / serverMoneyAvailable;
    const growThreadsNeeded = Math.ceil(ns.growthAnalyze(host, growthAmountNeeded) / 18) || 1;
    const weakenThreadsNeeded = Math.ceil(growThreadsNeeded / (18 * 6)) || 1;
    const newProcesses = [];

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
      \tNeed to Grow by (60% of Max): ${((serverMaxMoney * 0.6) / serverMoneyAvailable).toFixed(2)}
      \tGrow threads needed: ${Math.ceil(growThreadsNeeded)}
      \tStarting grow threads (1/18th speed): ${Math.ceil(growThreadsNeeded / 18)}
      *************************`);
      await scheduleAcrossHosts(ns, [{ host: 'home', availableRam: 99999 }], scriptPaths.watchGrowth, 1, host, processTag);
      return newProcesses;
    }
  }
}

async function weaken(ns: NS, host: string, controlledHostsWithMetadata: ControlledServers): Promise<HostProcesses> {
  const serverMaxMoney = ns.getServerMaxMoney(host);
  const currentSecurityLevel = ns.getServerSecurityLevel(host);
  const minimumSecurityLevel = ns.getServerMinSecurityLevel(host);
  const isAlreadyWeakened = currentSecurityLevel < 3 + minimumSecurityLevel;
  if (
    !isAlreadyWeakened
    && serverMaxMoney > 0
  ) {
    const newProcesses = [];
    // Spawn tons of weaken processes so it only needs to execute as few iterations as possible.
    const weakenThreadCount = Math.floor(
      (currentSecurityLevel - minimumSecurityLevel) / 0.05,
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
      return newProcesses;
    }
  }
}


export async function main(ns : NS) : Promise<void> {
  // Set by the "watch" scripts, cleared by the distributor.
  const notifications = new Set();
  const runningProcesses = new RunningProcesses();
  disableLogs(ns);
  let count = 1;
  let includedHostCount = 1;

  let rootedHosts = readJson('/data/rootedHosts.txt');
  let controlledHosts = readJson('/data/controlledHosts.txt');

  for (const host of controlledHosts) {
    await killHacks(ns, host);
  }

  while (true) {
    const newWeakens = [];
    const newGrows = [];
    const newHacks = []

    // Ramp up by slicing the array with an includedHostCount that is incremented by an algorithm below.
    rootedHosts = readJson('/data/rootedHosts.txt').slice(0, includedHostCount);
    controlledHosts = readJson('/data/controlledHosts.txt');

    const controlledHostsWithMetadata = getControlledHostsWithMetadata(ns, controlledHosts);

    if (notifications.size) {
      notifications.forEach(({ host, status }) => {
        const hostRunningProcesses = []
        switch (status) {
          case 'weakened':
            hostRunningProcesses = runningProcesses.weakening.get(host);
            runningProcesses.weakening.clear(host);
            break;
          case 'grown':
            hostRunningProcesses = runningProcesses.growing.get(host);
            runningProcesses.growing.clear(host);
            break;
          case 'hacked':
            hostRunningProcesses = runningProcesses.hacking.get(host);
            runningProcesses.hacking.clear(host);
            break;
          default:
            ns.tprint(`Unknown notification status from ${host}: ${status}`);
        }

        killProcesses(ns, hostRunningProcesses);
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
      \tCurrent Weaken Targets: ${Array.from(weakeningHosts.values()).join(', ')}
      \tCurrent Grow Targets: ${Array.from(growingHosts.values()).join(', ')}
      \tCurrent Hacks Targets: ${Array.from(hackingHosts.values()).join(', ')}
      \t*************  NEW TARGETS  ***************
      \t*******************************************
      \tNew Weaken Targets: ${newWeakens.join(', ')}
      \tNew Grow Targets: ${newGrows.join(', ')}
      \tNew Hacks Targets: ${newHacks.join(', ')}
      \t*******************************************
    `);
      newHacks = [];
      newGrows = [];
      newWeakens = [];
    }
    count += 1;
    if (count % 3 === 0) {
      ns.tprint('Increasing target host count.');
      includedHostCount += 1;
    } else {
      includedHostCount += 1;
    }
    await awaitAndProcessNotifications(ns);
  }
}
