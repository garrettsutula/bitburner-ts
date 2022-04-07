import { NS } from '@ns'
import { calculateWeaken, calculateGrow, calculateStepsDuration, calculateStepsRamNeeded, calculateWeakenDelay, calculateGrowDelay } from 'scheduler/stages/calculate'
import { Procedure } from '/models/procedure';
const scriptPaths = {
  weaken: '/scheduler/scripts/weakenOnce.js',
  grow: '/scheduler/scripts/growOnce.js',
};

export function prepareSchedule(ns: NS, host: string): Procedure {
  const weaken = calculateWeaken(ns, 1, host, scriptPaths.weaken);
  const grow = calculateGrow(ns, 2, host, scriptPaths.grow);
  const secondWeaken = calculateWeaken(ns, 3, host, scriptPaths.weaken, grow.securityLevelIncrease);

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
