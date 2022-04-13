import { NS } from '@ns';
import { ScheduledHost } from '/models/procedure';
const lastLogMessage: Map<string, number> = new Map();
const logIntervalMs = 1000 * 60;
const warnIntervalMs = 1000 * 10;
const errorIntervalMs = 1000 * 2;
import { percentMaxMoney } from './metrics';

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

function scheduledHostStatus(ns: NS, scheduledHost: ScheduledHost): string {
  let logLine =  `\t* ${scheduledHost.assignedProcedure} - ${scheduledHost.runningProcedures.size} running - ${scheduledHost.host}`;
  logLine += `${scheduledHost.assignedProcedure === 'prepare' ? `${percentMaxMoney(ns, scheduledHost.host)}% max money`: ''}`;
  return logLine;
}

export const logger = {
  log,
  info,
  warn,
  error,
  scheduledHostStatus,
}

export function disableLogs(ns: NS): void {
  ns.disableLog('disableLog');
  // Hacking
  ns.disableLog('getHackingLevel');
  ns.disableLog('getServerRequiredHackingLevel');
  ns.disableLog('getServerMinSecurityLevel');
  ns.disableLog('getServerSecurityLevel');
  // Server Money
  ns.disableLog('getServerMaxMoney');
  ns.disableLog('getServerMoneyAvailable');
  // Server RAM
  ns.disableLog('getServerUsedRam');
  ns.disableLog('getServerMaxRam');
  // Commands
  ns.disableLog('scan');
  ns.disableLog('scp');
  ns.disableLog('exec');
  ns.disableLog('kill');
  ns.disableLog('killall');
  ns.disableLog('sleep');
  ns.disableLog('run');
}

export function disableAllLogs(ns: NS): void {
  ns.disableLog('all');
}