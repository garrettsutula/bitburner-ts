import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  ns.run('spider.js');
  await ns.sleep(500);
  ns.run('scheduler.js');
  // ns.run('gangs.js');
  ns.run('stockMaster.js');
  ns.run('stats.js');

}