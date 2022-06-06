import { NS } from '@ns'
import { readJson } from '/lib/file';
import { ServerStats } from '/models/server';

export async function main(ns : NS) : Promise<void> {
  const controlledHosts = readJson(ns, '/data/serverStats.txt') as { [key: string]: ServerStats };
  const scripts = ns.ls('home', '/scripts/')
  Object.values(controlledHosts).forEach(({ name }) => {
    name !== 'home' ? ns.killall(name): scripts.forEach((script) => ns.scriptKill(script, 'home'));
  });
  //
}