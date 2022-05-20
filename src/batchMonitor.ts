import { NS } from '@ns'
import { clearPort, readPortJson } from '/lib/port';
import { renderBatches, logHTML } from '/lib/renderBatches';
import { Job, JobStartLog, ScriptEndLog, ScriptStartLog } from '/models/procedure';

const emptyPort = 'NULL PORT DATA'
const jobStartPort = 1;
const scriptStartPort = 2;
const scriptEndPort = 3;
const scriptCancelPort = 4;

type BatchMap = Job[][];

async function processSchedulerEvents(ns: NS, batches: BatchMap) {
  while (ns.peek(jobStartPort) !== emptyPort) {
    const event = readPortJson(ns, jobStartPort) as JobStartLog;
    if (Object.keys(event).length) {
      const newJob: Job = { args: event.args, threads: event.threads, startDifficulty: event.startDifficulty, change: event.change, batchId: event.batchId, processId: event.processId, task: event.task, duration: event.duration, startTime: event.startTime, endTime: event.endTime, cancelled: false };
      const batch = batches.find((batch) => batch.some((job) => job.batchId === event.batchId));
      if (batch) {
         batch.push(newJob);
      } else {
        batches.push([newJob]);
      }
    }
  }
}

async function processScriptStartEvents(ns: NS, batches: BatchMap) {
  while (ns.peek(scriptStartPort) !== emptyPort) {
    const event = readPortJson(ns, scriptStartPort) as ScriptStartLog;
    if (Object.keys(event).length) {
    const runningJob = batches.find((batch) => batch.some((job) => job.batchId === event.batchId))?.find((job) => job.processId === event.processId);
    if (runningJob) {
      runningJob.startTimeActual = event.startTimeActual;
    }
  }
}
}

async function processScriptEndEvents(ns: NS, batches: BatchMap) {
  while (ns.peek(scriptEndPort) !== emptyPort) {
    const event = readPortJson(ns, scriptEndPort) as ScriptEndLog;
    if (Object.keys(event).length) {
    const runningJob = batches.find((batch) => batch.some((job) => job.batchId === event.batchId))?.find((job) => job.processId === event.processId);
    if (runningJob) {
      runningJob.endTimeActual = event.endTimeActual;
      runningJob.result = event.result;
    }
  }
}
}

async function processScriptCancelEvents(ns: NS, batches: BatchMap) {
  while (ns.peek(scriptCancelPort) !== emptyPort) {
    const event = readPortJson(ns, scriptCancelPort) as ScriptEndLog;
    if (Object.keys(event).length) {
    const runningJob = batches.find((batch) => batch.some((job) => job.batchId === event.batchId))?.find((job) => job.processId === event.processId);
    if (runningJob) {
      runningJob.endTimeActual = event.endTimeActual;
      runningJob.cancelled = true;
    }
  }
}
}

export async function main(ns : NS) : Promise<void> {
  ns.disableLog('ALL');
  const batches: BatchMap = [];
  clearPort(ns, 1); // New scheduler events
  clearPort(ns, 2); // Script Start events
  clearPort(ns, 3); // Script End Events
  let element: any = null;
  while (true) {
    await processSchedulerEvents(ns, batches);
    await processScriptStartEvents(ns, batches);
    await processScriptEndEvents(ns, batches);
    await processScriptCancelEvents(ns, batches);
    const batchesArr = Array.from(batches.values()).map((jobs) => Array.from(jobs.values()));
    element = renderBatches(element, batchesArr, Date.now());
    logHTML(ns, element);
    await ns.sleep(50);
  }
}