import {
  NS
} from '@ns'

function getStatvalue(ns: NS, stat: string) {
  switch (stat) {
    case 'str':
      return ns.getPlayer().strength;
    case 'def':
      return ns.getPlayer().defense;
    case 'dex':
      return ns.getPlayer().dexterity;
    case 'agi':
      return ns.getPlayer().agility;
    default:
      throw new Error('Unknown stat.');
  }
}

// Workout until 50
// Unlock all the factions we can
// Join all the factions we can
// Work out until 200
// Join Factions
// Work out until 300

export async function main(ns: NS): Promise < void > {
  for (const stat of ['str', 'def', 'dex', 'agi']) {
    ns.gymWorkout('powerhouse gym', stat);
    while (getStatvalue(ns, stat) < 200) {
      await ns.sleep(10000);
    }
  }
}