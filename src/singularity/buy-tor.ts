import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  ns.purchaseTor();
  for (const prog of ns.getDarkwebPrograms()) {
      const cost = ns.getDarkwebProgramCost(prog);
      if (cost > 0) ns.purchaseProgram(prog);
  }
  ns.tprint('All darkweb programs purchased.');
}