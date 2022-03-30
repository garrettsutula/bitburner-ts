import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  while (true) {
    ns.commitCrime('shoplift');
    await ns.sleep(65000);
  }
}