import { NS } from '@ns';
const lastLogMessage: Map<string, number> = new Map();
const logIntervalMs = 1000 * 60;
const warnIntervalMs = 1000 * 10;
const errorIntervalMs = 1000 * 2;

function log(ns: NS, id: string, message: string, logInterval: number, bypassLogInterval = false): void {
  const lastLogTime = lastLogMessage.has(id) ? lastLogMessage.get(id) as number : 0;
  if (bypassLogInterval || (lastLogTime + logInterval <  Date.now())) {
    lastLogMessage.set(id, Date.now());
    ns.tprint(message);
  }
}

function info(ns: NS, id: string, message: string, bypassLogInterval?: boolean): void {
  log(ns, id, `INFO: ${message}`, logIntervalMs, bypassLogInterval);
}

function warn(ns: NS, id: string, message: string, bypassLogInterval?: boolean): void {
  log(ns, id, `WARN: ${message}`, warnIntervalMs, bypassLogInterval);
}

function error(ns: NS, id: string, message: string, bypassLogInterval?: boolean): void {
  log(ns, id, `ERROR: ${message}`, errorIntervalMs, bypassLogInterval);
}

export const logger = {
  log,
  info,
  warn,
  error,
}