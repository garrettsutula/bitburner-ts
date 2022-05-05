import { NS } from '@ns'
import { writePortJson } from '/lib/port';

export async function main(ns : NS) : Promise<void> {
  const target = ns.args[0] as string;
  const delay = ns.args[1] as number;
  const processId = ns.args[2] as string;
  const batchId = ns.args[2] as string;
  const monitorEnabled = ns.args[4] === 'monitor';
  await ns.sleep(delay);
  if (monitorEnabled) await writePortJson(ns, 2, {
    batchId,
    startTimeActual: Date.now(),
  });
  await ns.weaken(target);
  if (monitorEnabled) await writePortJson(ns, 3, {
    batchId,
    processId,
    endTimeActual: Date.now(),
    result: {
      hackDifficulty: ns.getServerSecurityLevel(target),
      minDifficulty: ns.getServerMinSecurityLevel(target),
    }
  });
}
