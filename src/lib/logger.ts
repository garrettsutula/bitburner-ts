import { NS } from '@ns';
import { ScheduledHost } from '/models/procedure';
import { percentMaxMoney } from '/lib/metrics';

const lastLogMessage: Map<string, number> = new Map();
const logIntervalMs = 1000 * 60;
const warnIntervalMs = 1000 * 10;
const errorIntervalMs = 1000 * 2;
const knownLogIntervals: {[key: string]: any} = {
  'outOfMemory': 1000 * 120,
}


function log(ns: NS, id: string, message: string, logInterval: number, bypassLogInterval = false): void {
  const lastLogTime = lastLogMessage.has(id) ? lastLogMessage.get(id) as number : 0;
  if (bypassLogInterval || (lastLogTime + (knownLogIntervals[id] ? knownLogIntervals[id] : logInterval) <  Date.now())) {
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
  const minSecurity = ns.getServerSecurityLevel(scheduledHost.host);
  const currentSecurity = ns.getServerSecurityLevel(scheduledHost.host);
  const overMinSecPct = (((currentSecurity/minSecurity) * 100) - 100).toFixed(1);
  let logLine =  `${scheduledHost.host} - ${scheduledHost.assignedProcedure}, ${scheduledHost.runningProcedures.length} running`;
  logLine += `\n\t% max money: ${percentMaxMoney(ns, scheduledHost.host)}\n\t% over min sec: ${overMinSecPct}`;
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