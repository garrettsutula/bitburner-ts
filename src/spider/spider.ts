import { NS } from '@ns'
import { writeJson } from 'lib/file';
import { disableLogs } from 'lib/logs';
// Managed by spider.js
const discoveredHosts = new Set<string>();
const rootedHosts = new Set<string>();
const controlledHosts = new Set<string>();
const exploitableHosts = new Set<string>();

function hasMoney(ns: NS, host: string) {
  return ns.getServerMaxMoney(host) > 0;
}

function prep(ns: NS, target: string) {
  const requiredHackingLevel = ns.getServerRequiredHackingLevel(target);
  const currentHackingLevel = ns.getHackingLevel();
  if (requiredHackingLevel
        > currentHackingLevel) {
    discoveredHosts.add(target);
    ns.tprint(`SPIDER: Can't hack ${target} yet, required level: ${requiredHackingLevel}`);
    return false;
  }
  if (ns.hasRootAccess(target)) {
    rootedHosts.add(target);
    controlledHosts.add(target);
    if (hasMoney(ns, target)) exploitableHosts.add(target);
    return true;
  }
  function can(action: string) {
    return ns.fileExists(`${action}.exe`, 'home');
  }

  let ports = 0;
  if (can('brutessh')) { ns.brutessh(target); ports += 1; }
  if (can('ftpcrack')) { ns.ftpcrack(target); ports += 1; }
  if (can('relaysmtp')) { ns.relaysmtp(target); ports += 1; }
  if (can('httpworm')) { ns.httpworm(target); ports += 1; }
  if (can('sqlinject')) { ns.sqlinject(target); ports += 1; }

  if (ports >= ns.getServerNumPortsRequired(target)) {
    rootedHosts.add(target);
    controlledHosts.add(target);
    if (hasMoney(ns, target)) exploitableHosts.add(target);
    return ns.nuke(target);
  }
  discoveredHosts.add(target);
  return false;
}

async function spider(ns: NS) {
  discoveredHosts.clear();
  rootedHosts.clear();
  controlledHosts.clear();
  const purchasedServers = ns.getPurchasedServers();
  let hosts: string[] = [];
  const seen = ['darkweb'].concat(purchasedServers);
  hosts.push('home');
  ['home'].concat(purchasedServers).forEach((host) => controlledHosts.add(host));
  while (hosts.length > 0) {
    const host = hosts.shift();
    if (host && !seen.includes(host)) {
      seen.push(host);
      // If we can root the host, scan and add the hosts we find to the hosts crawl list.
      if (host === 'home' || prep(ns, host)) {
        hosts = hosts.concat(ns.scan(host));
      }
    }
  }
  await writeJson(ns, '/data/discoveredHosts.txt', Array.from(discoveredHosts.values()));
  await writeJson(ns, '/data/rootedHosts.txt', Array.from(rootedHosts.values()));
  await writeJson(ns, '/data/controlledHosts.txt', Array.from(controlledHosts.values()));
  await writeJson(ns, '/data/exploitableHosts.txt', Array.from(exploitableHosts.values()));
}

export async function main(ns: NS) : Promise<void> {
  disableLogs(ns);

  while (true) {
    await spider(ns);
    await ns.sleep(60000);
  }
}