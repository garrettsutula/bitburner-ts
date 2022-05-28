import { NS, Server } from '@ns'
import { writeJson } from '/lib/file';
import { disableLogs, logger } from '/lib/logger';
import asTable from '/lib/ascii-table.js';
import { ServerStats } from '/models/server';
import { getNsDataThroughFile } from '/helpers';

// Managed by spider.js
const serverInfo: { [key: string]: ServerStats } = {};

function prep(ns: NS, target: string, targetServer: Server) {
  const targetInfo = new ServerStats(targetServer);
  serverInfo[target] = targetInfo;
  const currentHackingLevel = ns.getHackingLevel();
  if (targetInfo.reqHack
        > currentHackingLevel) {
    return false;
  }
  if (targetInfo.root) {
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

  if (ports >= targetInfo.reqPorts) {
    return ns.nuke(target);
  }
  return false;
}

async function spider(ns: NS) {
  let hosts: string[] = [];
  // const seen = ['darkweb'].concat(purchasedServers);
  const seen: string[] = [];
  hosts.push('home');
  while (hosts.length > 0) {
    const host = hosts.shift();
    if (host && !seen.includes(host)) {
      seen.push(host);
      let serverInfo;
      if (host !== 'home') serverInfo = await getNsDataThroughFile(ns, `ns.getServer("${host}")`, `/Temp/server.${host}.txt`);
      // If we can root the host, scan and add the hosts we find to the hosts crawl list.
      if (host === 'home' || prep(ns, host, serverInfo)) {
        hosts = hosts.concat(ns.scan(host));
      }
    }
  }

  const controlledHosts = Object.values(serverInfo).filter((server) => server.owned || (server.root && !server.name.includes('hacknet-node'))).map((server) => server.name);
  const scripts = ns.ls('home', '/scripts/').concat(...ns.ls('home', '/lib/'));
  const doScriptUpdate = ns.fileExists('updateScripts.txt');
  for(const host of controlledHosts) {
    const hasScripts = ns.ls(host, '/scripts/');
    if (!hasScripts.length || doScriptUpdate) {
      await getNsDataThroughFile(ns, `await ns.scp(${JSON.stringify(scripts)}, '${host}')`, `/Temp/scp-${host}.txt`);
    }
  }
  if (doScriptUpdate) await getNsDataThroughFile(ns, 'ns.rm("scriptUpdate.txt")', '/Temp/rmfile.txt');


  await writeJson(ns, '/data/serverInfo.txt', serverInfo);
  const title = `Spider Report - ${new Date().toLocaleTimeString()}`;
  const reportTable = Object.values(serverInfo).filter((server) => server.owned === false).map(({name, root, reqHack, reqPorts, ram, ramUsed, sec, minSec, pctOverMin, moneyMaxShort, pctMoneyMax, growMult})=> Object.assign({}, {name, root, 'req (p|h)': `${reqPorts} | ${reqHack}`, 'ram (u/t)': `${ramUsed.toFixed(0)} / ${ram}`, 'sec (% | c/m)':  `${pctOverMin}% | ${sec}/${minSec}`, 'money (% | max)': `${pctMoneyMax}% | ${moneyMaxShort}`, growMult}));
  logger.info(ns, 'spiderReport', `\n${title}\n${asTable.configure({delimiter: ' | '})(reportTable)}`, 'log');
}

export async function main(ns: NS) : Promise<void> {
  disableLogs(ns);
  // Save player information to file
  const player = await getNsDataThroughFile(ns, 'ns.getPlayer()', '/Temp/player-info.txt');
  await writeJson(ns, '/data/playerInfo.txt', player);
  // Save bitnode information to file
  const bitnode = await getNsDataThroughFile(ns, 'ns.getBitNodeMultipliers()', '/Temp/bitnode-info.txt');
  await writeJson(ns, '/data/bitnodeInfo.txt', bitnode);

  while (true) {
    await spider(ns);
    await ns.sleep(15000);
  }
}