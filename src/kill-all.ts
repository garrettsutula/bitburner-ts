import { NS } from '@ns'
import { readJson } from '/lib/file';

export async function main(ns : NS) : Promise<void> {
  const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[];
  const scripts = ns.ls('home', '/scripts/')
  controlledHosts.forEach((host) => {
    host !== 'home' ? ns.killall(host): scripts.forEach((script) => ns.scriptKill(script, 'home'));
  });
  //
}