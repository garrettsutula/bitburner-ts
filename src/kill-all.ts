import { NS } from '@ns'
import { readJson } from '/lib/file';

export async function main(ns : NS) : Promise<void> {
  const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[];

  controlledHosts.forEach((host) => {
    host !== 'home' ? ns.killall(host): ns.scriptKill('/scripts/basic-hack.js', 'home');
  });
  //
}