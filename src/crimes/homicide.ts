import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  while (true) {
    ns.tail();
    ns.commitCrime('homicide');
    await ns.sleep(3200);
  }
}