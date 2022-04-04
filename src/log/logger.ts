import { NS } from '@ns';
import { appendLog } from '/lib/file';
import { readJson } from '/lib/file';
const logResolutionMs = 1000 * 1;
 
export async function main(ns : NS) : Promise<void> {
  while (true) {
    const now = new Date().toISOString();
    const filePathTimestamp = new Date().toISOString().substring(0, 13).replace('T', '-');
    // Player Information
    const player: any = ns.getPlayer();
    player.moneyPerSecond = ns.getScriptIncome()[0];
    player['@timestamp'] = Date.now();
    await appendLog(ns, `/log/player.${filePathTimestamp}.txt`, [player]);
    // Server Information
    const exploitableHosts = (readJson(ns, '/data/exploitableHosts.txt') as string[]);
    await appendLog(ns, `/log/servers.${filePathTimestamp}.txt`, exploitableHosts.map((host) => {
      const server: any = ns.getServer(host);
      server['@timestamp'] = now;
      server.percentOfMaxMoney = (server.moneyAvailable / server.moneyMax) * 100;
      server.percentWeakened = (server.minDifficulty / server.hackDifficulty) * 100;
      return server;
    }));
    await ns.sleep(logResolutionMs);
  }
}

