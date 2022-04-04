import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  while (true) {
    ns.tail();
    ns.commitCrime('shoplift');
    await ns.sleep(2500);
  }
}