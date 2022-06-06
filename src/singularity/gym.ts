import { NS, Player } from '@ns'
import { disableLogs } from '/helpers';

function atTargetLevel(player: Player, targetLevel: number) {
  return [player.agility, player.strength, player.dexterity, player.defense].every((skill) => targetLevel < skill);
}

export async function main(ns : NS) : Promise<void> {
  disableLogs(ns, ['sleep']);
  ns.tail();
  const skills: Array<'agility' | 'strength' | 'defense' | 'dexterity'> = ['agility', 'strength', 'defense', 'dexterity'];
  const targetLevel = (ns.args[0] as number) || 100;
  while (!atTargetLevel(ns.getPlayer(), targetLevel)) {
    if(ns.getPlayer()[skills[0]] <= targetLevel) {
      if(!ns.singularity.isBusy()) ns.singularity.gymWorkout('powerhouse gym', skills[0]);
    } else {
      skills.shift();
      ns.singularity.gymWorkout('powerhouse gym', skills[0]);
    }
    await ns.sleep(1000);
  }
  ns.stopAction();
  ns.exit();
} 