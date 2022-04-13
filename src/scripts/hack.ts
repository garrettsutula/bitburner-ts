import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const target = ns.args[0].toString();
  while (true) {
    await ns.hack(target);
  }
}
