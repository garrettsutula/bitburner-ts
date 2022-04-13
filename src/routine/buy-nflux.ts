import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const { factions: joinedFactions } = ns.getPlayer();
  const playerAugs = ns.getOwnedAugmentations();
  // Get augmentations from all factions, filter out ones we already own and out the ones we need prereqs for still.
  const factionsRep = joinedFactions.map((faction) => ns.getFactionRep(faction));
  const factions = joinedFactions.map((faction, i) => {
    return {faction, rep: factionsRep[i]}
  });
  factions.sort((a, b) => b.rep - a.rep);
  let money = ns.getPlayer().money;
  while (money > ns.getAugmentationPrice("NeuroFlux Governor")) {
    const results = ns.purchaseAugmentation(factions[0].faction, "NeuroFlux Governor");
    await ns.sleep(50);
    money = ns.getPlayer().money;
  }
}
