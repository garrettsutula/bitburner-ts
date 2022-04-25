import { NS } from '@ns';

function getHashItem(arg: string) {
  switch(arg) {
    case 'money':
    case '$':
    default:
      return 'Sell for Money';
    case 'corp$':
    case 'corpMoney':
      return 'Sell for Corporation Funds';
    case 'research':
      return 'Exchange for Corporation Research';
  }
}

export async function main(ns : NS) : Promise<void> {
  const purchasedItem = getHashItem(ns.args[0] as string);
  while (true) {
    if (ns.hacknet.numHashes() > ns.hacknet.hashCost(purchasedItem)) {
      while(ns.hacknet.numHashes() > ns.hacknet.hashCost(purchasedItem)) {
        ns.hacknet.spendHashes(purchasedItem);
      }
    }
    await ns.sleep(10000);
  }
}