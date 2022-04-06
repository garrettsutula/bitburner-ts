import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
  while (true) {
    ns.tail();
    ns.commitCrime('mug someone');
    while(ns.isBusy()) {
      await ns.sleep(50);
    }
  }
}
