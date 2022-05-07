import { NS } from '@ns';
import { calculationParameters } from 'config';

const { maxServeryMoneyPercentage, maxSecurityThreshold } = calculationParameters

export function isAlreadyWeakened(ns: NS, host: string): boolean {
  const currentSecurityLevel = ns.getServerSecurityLevel(host);
  const minSecurityLevel = ns.getServerMinSecurityLevel(host)
  return currentSecurityLevel < minSecurityLevel * maxSecurityThreshold;
}

export function isAlreadyGrown(ns: NS, host: string): boolean {
  const maxMoney = ns.getServerMaxMoney(host);
  const moneyAvailable = ns.getServerMoneyAvailable(host);
  return maxMoney * maxServeryMoneyPercentage <= moneyAvailable;
}

export function percentMaxMoney(ns: NS, host: string): string {
  return ((ns.getServerMoneyAvailable(host) / ns.getServerMaxMoney(host)) * 100).toFixed(2);
}

export function percentOverMinSecurity(ns: NS, host: string): string {
  const minSecurity = ns.getServerSecurityLevel(host);
  const currentSecurity = ns.getServerSecurityLevel(host);
  return (((currentSecurity/minSecurity) * 100) - 100).toFixed(1);
}