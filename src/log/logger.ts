import { NS } from '@ns';
import { appendLog } from '/lib/file';
import { readJson } from '/lib/file';
const logResolutionMs = 1000 * 5;


export async function main(ns : NS) : Promise<void> {
  while (true) {
    const now = new Date().toISOString();
    const filePathTimestamp = new Date().toISOString().substring(0, 13).replace('T', '-');
    const exploitableHosts = (readJson(ns, '/data/exploitableHosts.txt') as string[]);
    await appendLog(ns, `/log/servers.${filePathTimestamp}.txt`, exploitableHosts.map((host) => {
      const server: any = ns.getServer(host)
      server.timestamp = now;
      return server;
    }));
    await ns.sleep(logResolutionMs);
  }
}

