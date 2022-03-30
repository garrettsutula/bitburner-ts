// Managed by spider.js
const discoveredHosts = new Set();
const rootedHosts = new Set();
const controlledHosts = new Set();

/** @param {import("..").NS } ns */
function prep(ns, target) {
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
    return true;
  }
  function can(action) {
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
    return ns.nuke(target);
  }
  discoveredHosts.add(target);
  return false;
}

/** @param {import("..").NS } ns */
async function spider(ns) {
  discoveredHosts.clear();
  rootedHosts.clear();
  controlledHosts.clear();
  const purchasedServers = ns.getPurchasedServers();
  let hosts = [];
  const seen = ['darkweb'].concat(purchasedServers);
  hosts.push('home');
  ['home'].concat(purchasedServers).forEach((host) => controlledHosts.add(host));
  while (hosts.length > 0) {
    const host = hosts.shift();

    if (!seen.includes(host)) {
      seen.push(host);
      // If we can root the host, scan and add the hosts we find to the hosts crawl list.
      if (host === 'home' || prep(ns, host)) {
        hosts = hosts.concat(ns.scan(host));
      }
    }
  }
  await ns.write('/data/discoveredHosts.txt', JSON.stringify(Array.from(discoveredHosts.values())), 'w');
  await ns.write('/data/rootedHosts.txt', JSON.stringify(Array.from(rootedHosts.values())), 'w');
  await ns.write('/data/controlledHosts.txt', JSON.stringify(Array.from(controlledHosts.values())), 'w');
}

/** @param {import("..").NS } ns */
export async function main(ns) {
  ns.disableLog('sleep');
  ns.disableLog('getHackingLevel');
  ns.disableLog('getServerRequiredHackingLevel');
  ns.disableLog('scan');

  while (true) {
    await spider(ns);
    await ns.sleep(60000);
  }
}
