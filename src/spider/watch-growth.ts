import { NS } from '@ns'
import { disableLogs } from 'lib/logs';

export async function main(ns : NS) : Promise<void> {
  disableLogs(ns);
  const target = ns.args[0].toString();
  const serverMaxMoney = ns.getServerMaxMoney(target);
  const securityThresh = ns.getServerMinSecurityLevel(target) + 5;
  while (
    ns.getServerMoneyAvailable(target) < 0.90 * serverMaxMoney
  && ns.getServerSecurityLevel(target) < securityThresh
  ) {
    await ns.sleep(10000);
    ns.print(`\tProgress: ${(((ns.getServerMoneyAvailable(target) / (0.90 * serverMaxMoney)) * 100).toFixed(2))}%
    Current Money: ${ns.getServerMoneyAvailable(target)}
    Cancel Security Threshold: ${securityThresh}
    Current Security Level: ${ns.getServerSecurityLevel(target).toFixed(1)}
    ---------------------------------------`);
  }
  if (ns.getServerMoneyAvailable(target) > 0.85 * serverMaxMoney) ns.tprint(`${target} is now GROWN, ready to hack.`);
  if (ns.getServerSecurityLevel(target) > securityThresh) ns.tprint(`ENDING EARLY: ${target} past security threshold. Current: ${ns.getServerSecurityLevel(target)}, Target: ${securityThresh}`);
  await ns.write(`/notifications/${target}.notification.txt`, `{"host": "${target}", "status": "grown"}`, 'w');
}