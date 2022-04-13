import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const installedAugs = ns.getOwnedAugmentations();
  const purchasedAugs = ns.getOwnedAugmentations(true).filter((aug) => !installedAugs.includes(aug) || aug === "NeuroFlux Governor");
  if (purchasedAugs.length > 15 || purchasedAugs.includes("NeuroFlux Governor")) ns.installAugmentations('/startup.js');
}