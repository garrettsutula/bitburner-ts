import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const target = ns.args[0] as string;
  const delay = ns.args[1] as number;
  await ns.sleep(delay);
  await ns.grow(target);
}