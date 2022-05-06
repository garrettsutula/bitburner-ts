import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const factions = ns.getPlayer().factions.filter((faction) => faction !== 'Shadows of Anarchy');
  const playerAugs = ns.getOwnedAugmentations();
  // Get augmentations from all factions, filter out ones we already own and out the ones we need prereqs for still.
  const factionsRep = factions.map((faction) => ns.getFactionRep(faction));
  const factionAugs = factions
  .map((faction, i) => ns.getAugmentationsFromFaction(faction)
    .filter((aug) => !playerAugs.includes(aug))
    .filter((aug) => ns.getAugmentationPrereq(aug).every((prereq) => playerAugs.includes(prereq)))
    .filter((aug) => ns.getPlayer().money > ns.getAugmentationPrice(aug))
    .filter((aug) => ns.getAugmentationRepReq(aug) < factionsRep[i]));
   const augsToBuy = Array.from(new Set(factionAugs.flatMap((augs) => augs)));
   ns.tprint(`INFO: Augs to purchase: ${JSON.stringify(augsToBuy)}`);
   augsToBuy.sort((a, b) => ns.getAugmentationPrice(b) - ns.getAugmentationPrice(a));
  while (augsToBuy.length > 0 && ns.getPlayer().money > ns.getAugmentationPrice(augsToBuy[0])) {
    const aug = augsToBuy.shift() as string;
    const faction = factions.find((faction, i) => factionAugs[i].includes(aug)) as string;
    ns.purchaseAugmentation(faction, aug);
    await ns.sleep(50);
  }
}
