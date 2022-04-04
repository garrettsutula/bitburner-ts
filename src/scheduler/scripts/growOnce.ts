import { NS } from '@ns'
import { appendLog } from 'lib/file';


export async function main(ns : NS) : Promise<void> {
  const filePathTimestamp = new Date().toISOString().substring(0, 13).replace('T', '-');
  const started = new Date().toISOString();
  const target = ns.args[0] as string;
  const delay = ns.args[1] as number;
  const processId = ns.args[2] as string;
  await ns.sleep(delay);
  const addedMoney = await ns.grow(target);
  const ended = new Date().toISOString();
  await appendLog(ns, `/log/process.${filePathTimestamp}.txt`, [{processId, type: 'grow', started, ended, target, addedMoney }]);
}