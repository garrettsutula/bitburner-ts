import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  let {money} = ns.getPlayer();
  while (money * 0.10 > ns.getUpgradeHomeCoresCost()) {
    ns.upgradeHomeCores();
    await ns.sleep(500);
    money = ns.getPlayer().money;
  }
}