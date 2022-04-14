import { NS } from '@ns';
import { calculationParameters } from '/config';

const { maxServeryMoneyPercentage, maxSecurityThreshold } = calculationParameters

export function isAlreadyWeakened(ns: NS, host: string): boolean {
  return ns.getServerSecurityLevel(host) < ns.getServerMinSecurityLevel(host) * maxSecurityThreshold;
}

export function isAlreadyGrown(ns: NS, host: string): boolean {
  return ns.getServerMaxMoney(host) * maxServeryMoneyPercentage <= ns.getServerMoneyAvailable(host);
}

export function percentMaxMoney(ns: NS, host: string): string {
  return ((ns.getServerMoneyAvailable(host) / ns.getServerMaxMoney(host)) * 100).toFixed(2);
}