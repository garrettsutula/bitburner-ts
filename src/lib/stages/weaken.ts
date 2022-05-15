import { NS } from '@ns'
import { calculateWeaken, calculateStepsDuration, calculateStepsRamNeeded, } from '/lib/stages/calculate'
import { Procedure } from '/models/procedure';
import { scriptPaths } from '/config';

export function weakenSchedule(ns: NS, host: string): Procedure {
  const weaken = calculateWeaken(ns, 1, host, scriptPaths.weakenOnce, undefined, true);

  const steps = [ weaken, ].filter((step) => step.threadsNeeded > 0);

  return {
    type: 'weaken',
    steps,
    totalDuration: calculateStepsDuration(steps),
    totalRamNeeded: calculateStepsRamNeeded(steps),
  }
}
