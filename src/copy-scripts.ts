import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const host = ns.args[0] as string;
  const scripts = ns.ls('home', '/scripts/');
  await ns.scp(scripts, host);
}