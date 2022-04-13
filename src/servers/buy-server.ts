import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const ram = (ns.args[0] as number) || 8192;
  const intervalSeconds = 15 * 1000;
  ns.disableLog('sleep');
  ns.disableLog('getServerMoneyAvailable');

  let purchasedServerCount = ns.getPurchasedServers().length;

  while (purchasedServerCount <= ns.getPurchasedServerLimit()) {
    if (ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram)) {
      const hostname = ns.purchaseServer(`gserv-${purchasedServerCount}`, ram);
      ns.tprint(`Purchased server: ${hostname}@${ram / 1000 / 1000}PB`);
      purchasedServerCount += 1;
    }
    await ns.sleep(intervalSeconds);
  }
}
