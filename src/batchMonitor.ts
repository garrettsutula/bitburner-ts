import { NS } from '@ns'
import { clearPort, readPortJson } from '/lib/port';
import { renderBatches } from '/lib/renderBatches';
import { Job, JobStartLog, ScriptEndLog, ScriptStartLog } from '/models/procedure';

const emptyPort = 'NULL PORT DATA'
const jobStartPort = 1;
const scriptStartPort = 2;
const scriptEndPort = 3;

type BatchMap = Map<string, Map<string, Job>>;

async function processSchedulerEvents(ns: NS, batches: BatchMap) {
  while (ns.peek(jobStartPort) !== emptyPort) {
    const event = readPortJson(ns, jobStartPort) as JobStartLog;
    const jobMap = new Map<string, Job>();
    jobMap.set(event.processId, { processId: event.processId, task: event.task, duration: event.duration, startTime: event.startTime, endTime: event.endTime })
    batches.set(event.batchId, jobMap);
  }
}

async function processScriptStartEvents(ns: NS, batches: BatchMap) {
  while (ns.peek(scriptStartPort) !== emptyPort) {
    const event = readPortJson(ns, scriptStartPort) as ScriptStartLog;
    const jobMap = batches.get(event.batchId);
    const job = jobMap?.get(event.processId) as Job;
    job.startTimeActual = event.startTimeActual;
    jobMap?.set(event.processId, job);
  }
}

async function processScriptEndEvents(ns: NS, batches: BatchMap) {
  while (ns.peek(scriptEndPort) !== emptyPort) {
    const event = readPortJson(ns, scriptEndPort) as ScriptEndLog;
    const jobMap = batches.get(event.batchId);
    const job = jobMap?.get(event.processId) as Job;
    job.endTimeActual = event.endTimeActual;
    job.result = event.result;
    jobMap?.set(event.processId, job);
  }
}

export async function main(ns : NS) : Promise<void> {
  const batches: BatchMap = new Map();
  clearPort(ns, 1); // New scheduler events
  clearPort(ns, 2); // Script Start events
  clearPort(ns, 3); // Script End Events
  while (true) {
    await processSchedulerEvents(ns, batches);
    await processScriptStartEvents(ns, batches);
    await processScriptEndEvents(ns, batches);
    const batchesArr = Array.from(batches.values()).map((jobs) => Array.from(jobs.values()));
    renderBatches(null, batchesArr, Date.now());
    await ns.sleep(0);
  }
}