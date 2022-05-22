import { NS } from '@ns'
import { writeJson } from '/lib/file';
import { disableLogs, logger } from '/lib/logger';
import asTable from '/lib/ascii-table.js';
import { ServerStats } from '/models/server';
// Managed by spider.js
const discoveredHosts = new Set<string>();
const rootedHosts = new Set<string>();
const controlledHosts = new Set<string>();
const exploitableHosts = new Set<string>();
const serverStats: { [key: string]: ServerStats } = {};

function prep(ns: NS, target: string) {
  const stats = new ServerStats(ns.getServer(target));
  if(!stats.owned) serverStats[target] = stats;
  const currentHackingLevel = ns.getHackingLevel();
  if (stats.reqHack
        > currentHackingLevel) {
    discoveredHosts.add(target);
    return false;
  }
  if (stats.root) {
    rootedHosts.add(target);
    controlledHosts.add(target);
    if (stats.moneyMax > 0) exploitableHosts.add(target);
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

  if (ports >= stats.reqPorts) {
    rootedHosts.add(target);
    controlledHosts.add(target);
    if (stats.moneyMax > 0) exploitableHosts.add(target);
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
  purchasedServers.concat(['home']).forEach((host) => controlledHosts.add(host));
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

  const controlledHostsArr = Array.from(controlledHosts.values());
  const scripts = ns.ls('home', '/scripts/').concat(...ns.ls('home', '/lib/'));
  const doScriptUpdate = ns.fileExists('updateScripts.txt');
  for(const host of controlledHostsArr) {
    const hasScripts = ns.ls(host, '/scripts/');
    if (!hasScripts.length || doScriptUpdate) {
      await ns.scp(scripts, host);
    }
  }
  if (doScriptUpdate) ns.rm('scriptUpdate.txt');

  await writeJson(ns, '/data/discoveredHosts.txt', Array.from(discoveredHosts.values()));
  await writeJson(ns, '/data/rootedHosts.txt', Array.from(rootedHosts.values()));
  await writeJson(ns, '/data/controlledHosts.txt', Array.from(controlledHosts.values()));
  await writeJson(ns, '/data/exploitableHosts.txt', Array.from(exploitableHosts.values()));
  await writeJson(ns, '/data/serverStats.txt', serverStats);
  const title = `Spider Report - ${new Date().toLocaleTimeString()}`;
  const reportTable = Object.values(serverStats).map(({name, root, reqHack, reqPorts, ram, ramUsed, sec, minSec, pctOverMin, moneyMaxShort, pctMoneyMax, growMult})=> Object.assign({}, {name, root, reqHack, reqPorts, ram, ramUsed, minSec,  '% > min. sec.': pctOverMin, maxMoney: moneyMaxShort, 'max. money %': pctMoneyMax, growMult}));
  logger.info(ns, 'spiderReport', `\n${title}\n${asTable.configure({delimiter: ' | '})(reportTable)}`, 'console', true);
}

export async function main(ns: NS) : Promise<void> {
  disableLogs(ns);

  while (true) {
    await spider(ns);
    await ns.sleep(15000);
  }
}