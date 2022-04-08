import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const target = ns.args[0] as string;
  const delay = ns.args[1] as number;
  const processId = ns.args[2] as string;
  const step = ns.args[3] as number;
  await ns.sleep(delay);
  const amount = await ns.grow(target);
  //ns.tprint(`  #${step}|${processId} - ${target} - g(${amount.toFixed(2)})\n`);
  //if (amountGrown === 0) ns.tprint(`ERROR: ZERO GROW FOR ${target}, current balance: ${ns.getServerMoneyAvailable(target)}`);
}