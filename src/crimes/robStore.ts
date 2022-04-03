import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  while (true) {
    ns.tail();
    ns.commitCrime('rob store');
    await ns.sleep(62000);
  }
}