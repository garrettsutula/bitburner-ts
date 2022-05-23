import { NS } from '@ns';
const requiresTarget = [
  'Reduce Minimum Security',
  'Increase Maximum Money', 
]

function getHashItem(ns: NS, name: string, target: string) {
  if (requiresTarget.includes(name) && !target) {
    ns.tprint(`ERROR: Command '${name}' requires second arg to specify target.`);
    ns.exit();
  }

  switch(name) {
    case 'money':
    case '$':
    default:
      return 'Sell for Money';
    case 'corp$':
    case 'corpMoney':
      return 'Sell for Corporation Funds';
    case 'research':
      return 'Exchange for Corporation Research';
    case 'gym':
      return 'Improve Gym Training';
    case 'university':
    case "uni":
      return "Improve Studying";
    case "rank":
      return "Exchange for Bladeburner Rank";
    case 'sec':
    case 'security':
      return 'Reduce Minimum Security';
    case 'serverMax':
      return 'Increase Maximum Money';
    case 'bbRank':
      return 'Exchange for Bladeburner Rank';
    case 'bbSp':
    case 'bbSP':
      return 'Exchange for Bladeburner SP';
  }
}

export async function main(ns : NS) : Promise<void> {
  ns.disableLog('sleep');
  const [ name, target ] = ns.args as string[];
  const purchasedItem = getHashItem(ns, name, target);
  while (true) {
    if (ns.hacknet.numHashes() > ns.hacknet.hashCost(purchasedItem)) {
      while(ns.hacknet.numHashes() > ns.hacknet.hashCost(purchasedItem)) {
        ns.hacknet.spendHashes(purchasedItem, target);
        await ns.sleep(10);
      }
    }
    await ns.sleep(10000);
  }
}