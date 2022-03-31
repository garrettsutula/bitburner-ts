import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
  while (true) {
    ns.commitCrime('mug someone');
    await ns.sleep(4500);
  }
}
