import { NS } from '@ns'
import { appendLog } from 'lib/file';

export async function main(ns : NS) : Promise<void> {
  const filePathTimestamp = new Date().toISOString().substring(0, 13).replace('T', '-');
  const started = Date.now();
  const target = ns.args[0] as string;
  const delay = ns.args[1] as number;
  const processId = ns.args[2] as string;
  await ns.sleep(delay);
  const securityDecrease = await ns.weaken(target);
  const ended = Date.now()
  await appendLog(ns, `/log/process.${filePathTimestamp}.txt`, [{processId, type: 'weaken', started, ended, target, securityDecrease }]);
}
