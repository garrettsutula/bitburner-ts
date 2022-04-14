import { NS } from '@ns'
import { calculateWeaken, calculateGrow, calculateStepsDuration, calculateStepsRamNeeded, calculateWeakenDelay, calculateGrowDelay } from '/lib/stages/calculate'
import { Procedure } from '/models/procedure';
import { scriptPaths } from '/config';

export function prepareSchedule(ns: NS, host: string): Procedure {
  const weaken = calculateWeaken(ns, 1, host, scriptPaths.weakenOnce);
  const grow = calculateGrow(ns, 2, host, scriptPaths.growOnce);
  const secondWeaken = calculateWeaken(ns, 3, host, scriptPaths.weakenOnce, grow.securityLevelIncrease);

  weaken.delay = calculateWeakenDelay(ns, host, weaken.ordinal);
  grow.delay = calculateGrowDelay(ns, host);
  secondWeaken.delay = calculateWeakenDelay(ns, host, secondWeaken.ordinal);

  const steps = [ weaken, grow, secondWeaken ];

  return {
    type: 'prepare',
    steps,
    totalDuration: calculateStepsDuration(steps),
    totalRamNeeded: calculateStepsRamNeeded(steps),
  }
}
