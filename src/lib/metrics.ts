import { NS } from '@ns';
// Servers need to be prepared if below this % money
const maxServerMoneyPct = 0.90;
// Hosts need to be weakened if their current security is above this times the multiplier
const minSecurityMultiplier = 1.8;

export function isAlreadyWeakened(ns: NS, host: string) {
  return ns.getServerSecurityLevel(host) < ns.getServerMinSecurityLevel(host) * minSecurityMultiplier;
}

export function isAlreadyGrown(ns: NS, host: string) {
  return ns.getServerMaxMoney(host) * maxServerMoneyPct <= ns.getServerMoneyAvailable(host);
}

export function percentWeakened(ns: NS, host: string) {
  return ((ns.getServerSecurityLevel(host) / (ns.getServerBaseSecurityLevel(host) - ns.getServerMinSecurityLevel(host))) * 100).toFixed(2);
}

export function percentMaxMoney(ns: NS, host: string) {
  return ((ns.getServerMoneyAvailable(host) / ns.getServerMaxMoney(host)) * 100).toFixed(2);
}