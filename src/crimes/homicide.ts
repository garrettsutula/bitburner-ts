import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  while (true) {
    const result = ns.commitCrime('homicide');
    await ns.sleep(3200);
  }
}