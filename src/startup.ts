import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  ns.run('/spider/spider.js');
  await ns.sleep(500);
  ns.run('/scheduler/scheduler.js')
  // ns.run('gangs.js');
  ns.run('stockMaster.js');
  ns.run('/ui/stats.js');

  /*
  ns.purchaseTor();
  while (ns.getDarkwebPrograms().length > 0) {
    const programs = ns.getDarkwebPrograms();
    programs.forEach((program) => {
      const cost = ns.getDarkwebProgramCost(program);
      if (cost > 0) ns.purchaseProgram(program);
    })
    await ns.sleep(500);
  }
  ns.tprint('All darkweb programs purchased.');
  */
}