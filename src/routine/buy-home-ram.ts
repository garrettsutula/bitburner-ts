import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const upgradeCost = ns.getUpgradeHomeRamCost();
  let {money} = ns.getPlayer();
  while (money * 0.10 > upgradeCost) {
    ns.upgradeHomeRam();
    await ns.sleep(500);
    money = ns.getPlayer().money;
  }
}