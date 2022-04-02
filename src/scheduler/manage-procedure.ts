import { NS } from '@ns'
import { disableLogs } from 'lib/logs';
import { readPortJson, writePortJson } from 'lib/port';
import { scheduleAcrossHosts } from 'lib/process';
import { QueuedProcedure } from 'models/procedure';
import { readJson, writeJson } from '/lib/file';
import { ControlledServers } from '/models/server';

export async function main(ns : NS) : Promise<void> {
  disableLogs(ns);
  const processId = ns.args[0].toString();
  const targetHost = ns.args[1].toString(); // Unused, added so we can easily see the hostname in the running scripts list.
  // Read Procedure instructions from start port (7).
  const { host, procedure: { steps, totalDuration } } = readPortJson(ns, 7) as QueuedProcedure;
  let index = 0;
  for (const step of steps) {
    ns.print(`
    Processing Step ${index + 1} of ${steps.length}
    Expected Duration: ${step.duration}
    Script: ${step.script}`);
    
    ns.print(`${step.script} sleeping for ${(step.delay || 0/1000).toFixed(1)} seconds then executing.`);
    const controlledHosts = readJson(ns, '/data/controlledHostsMetadata.txt') as ControlledServers[];
    const processes = await scheduleAcrossHosts(ns, controlledHosts, step.script, step.threadsNeeded, host, step.delay || 0, processId);
    await writeJson(ns, '/data/controlledHostsMetadata.txt', controlledHosts);
    const timeStarted = Date.now();
    await writePortJson(ns, 8, { host, processId, processes, timeStarted });
    index +=1;
  }
  await ns.sleep(totalDuration);
  ns.print('all steps executed, terminating manage procedure');
  // Send kill signal back to processor
  await writePortJson(ns, 9, { host, processId });
  // Log output and end
}
