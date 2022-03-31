import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {

  const mainFactionList = [
    'NiteSec',
    'Sector-12',
    'CyberSec',
    'Tian Di Hui',
    'Netburners',
    'The Black Hand',
    'BitRunners',
    'Slum Snakes',
    'Tetrads',
    'Speakers for the Dead',
    'The Dark Army',
    'The Syndicate',
    'The Covenant',
    'Daedelus',
    'Illuminati',
  ];

  const cityFactionList = [
    'Sector-12',
    'Chongqing',
    'New Tokyo',
    'Ishima',
    'Aevum',
    'Volhaven',
  ];

  const factions = new Map<string, {[key: string]: any}>();

  mainFactionList.forEach((faction) => {
    const stats: any = {};
    stats.rep = ns.getFactionRep(faction);
    stats.favor = ns.getFactionFavor(faction);
    stats.availableAugs = ns.getAugmentationsFromFaction(faction);
    factions.set(faction, stats);
  });
}