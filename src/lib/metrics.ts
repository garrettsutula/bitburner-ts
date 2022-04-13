import { NS } from '@ns';
// Servers need to be prepared if below this % money
const maxServerMoneyPct = 0.80;
// Hosts need to be weakened if their current security is above this times the multiplier
const minSecurityBuffer = 2;

export function isAlreadyWeakened(ns: NS, host: string): boolean {
  return ns.getServerSecurityLevel(host) < ns.getServerMinSecurityLevel(host) + minSecurityBuffer;
}

export function isAlreadyGrown(ns: NS, host: string): boolean {
  return ns.getServerMaxMoney(host) * maxServerMoneyPct <= ns.getServerMoneyAvailable(host);
}

export function percentWeakened(ns: NS, host: string): string {
  const pctToGoal = ((ns.getServerSecurityLevel(host) - ns.getServerMinSecurityLevel(host)) / ns.getServerSecurityLevel(host)) + 1;
  return (pctToGoal * 100).toFixed(2);
}

export function percentMaxMoney(ns: NS, host: string): string {
  return ((ns.getServerMoneyAvailable(host) / ns.getServerMaxMoney(host)) * 100).toFixed(2);
}