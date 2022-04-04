import { NS } from '@ns'

export async function main(ns: NS): Promise<void> {
  while (true) {
    ns.tail();
    ns.commitCrime('deal drugs');
    await ns.sleep(65000);
  }
}
