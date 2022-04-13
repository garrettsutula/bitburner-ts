import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const target = ns.args[0] as string;
  const delay = ns.args[1] as number;
  await ns.sleep(delay);
  const amount = await ns.hack(target);
  //ns.tprinat(`  #${step}|${processId} - ${target} - h(${amount.toFixed(2)})\n`);
  if (amount === 0) ns.tprint(`ERROR: ZERO $ HACKED FOR ${target}, current balance: ${ns.getServerMoneyAvailable(target)}`);
}
