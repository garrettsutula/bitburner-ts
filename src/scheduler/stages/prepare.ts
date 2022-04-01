import { NS } from '@ns'
import { calculateWeaken, calculateGrow, calculateStepsDuration, calculateStepsRamNeeded } from 'scheduler/stages/calculate'
import { Procedure } from '/models/procedure';
const scriptPaths = {
  weaken: '/spider/weaken.js',
  grow: '/spider/grow.js',
};

export function prepareSchedule(ns: NS, host: string): Procedure {
  const weaken = calculateWeaken(ns, host, scriptPaths.weaken);
  const grow = calculateGrow(ns, host, scriptPaths.grow);
  const secondWeaken = calculateWeaken(ns, host, scriptPaths.weaken, grow.securityLevelIncrease);

  const steps = [ weaken, grow, secondWeaken ];

  return {
    type: 'exploit',
    steps,
    totalDuration: calculateStepsDuration(steps),
    totalRamNeeded: calculateStepsRamNeeded(steps),
  }
}
