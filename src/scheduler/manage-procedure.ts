import { NS } from '@ns'
import { disableLogs } from 'lib/logs';
import { readPortJson, writePortJson } from 'lib/port';
import { scheduleAcrossHosts } from 'lib/process';
import { QueuedProcedure } from 'models/procedure';
import { readJson } from '/lib/file';
import { ControlledServers } from '/models/server';

export async function main(ns : NS) : Promise<void> {
  disableLogs(ns);
  const processId = ns.args[0].toString();
  // Read Procedure instructions from start port (7).
  const { host, procedure: { steps } } = readPortJson(ns, 7) as QueuedProcedure;
  steps.sort(({duration: firstDuration}, {duration: secondDuration}) => firstDuration - secondDuration);
  let index = 0;
  const now = Date.now();
  for (const step of steps) {
    const projectedCompletion = now + step.duration;
    if (steps[index + 1]) {
      const nextStep = steps[index + 1];
      const controlledHosts = readJson(ns, '/data/controlledHostsMetadata.txt') as ControlledServers[];
      const processes = await scheduleAcrossHosts(ns, controlledHosts, step.script, step.threadsNeeded, host, processId);
      // Send new processes spawned back to scheduler.
      const timeStarted = Date.now();
      await writePortJson(ns, 8, { host, processId, processes, timeStarted });
      await ns.sleep(projectedCompletion - (nextStep.duration + 250));
      index += 1 ;
    }
  }
  // Send kill signal back to processor
  await writePortJson(ns, 9, { host, processId });
  // Log output and end
}