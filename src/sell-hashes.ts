import { NS } from '@ns';
const sellForMoney = 'Sell for Money';
const sellForCorp = 'Sell for Corporation Funds';
const exchangeForCorpResearch = 'Exchange for Corporation Research';

export async function main(ns : NS) : Promise<void> {
  const threshold = (ns.args[0] as number) || 30;
  while (true) {
    const nodesCount= new Array(ns.hacknet.numNodes()).fill(null);
    const totalProduction = nodesCount.reduce((acc, val, i) => {
      const currentNode = ns.hacknet.getNodeStats(i);
      return acc + currentNode.production;
    }, 0);
    const purchasedItem = totalProduction > threshold ? exchangeForCorpResearch : exchangeForCorpResearch;
    if (ns.hacknet.numHashes() > ns.hacknet.hashCost(purchasedItem)) {
      while(ns.hacknet.numHashes() > ns.hacknet.hashCost(purchasedItem)) {
        ns.hacknet.spendHashes(purchasedItem);
      }
    }
    await ns.sleep(10000);
  }
}