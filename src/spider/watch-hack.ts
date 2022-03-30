import { NS } from '@ns'
import { disableLogs } from 'lib/logs';

export async function main(ns : NS) : Promise<void> {

  const [target] = ns.args;
  const serverInitialMoney = ns.getServerMoneyAvailable(target);
  const serverMaxMoney = ns.getServerMaxMoney(target);
  const moneyThresh = 0.50 * serverMaxMoney;
  const securityThresh = ns.getServerMinSecurityLevel(target) + 5;
  while (
    ns.getServerMoneyAvailable(target) > moneyThresh
  && ns.getServerSecurityLevel(target) < securityThresh
  ) {
    await ns.sleep(5000);
    ns.print(`\tProgress: ${(((ns.getServerMoneyAvailable(target) - moneyThresh) / (serverInitialMoney - moneyThresh)) * 100).toFixed(2)}%
    Current Money: ${ns.getServerMoneyAvailable(target)}
    Target Money: ${moneyThresh}
    Security Level (curr./max allowed): ${ns.getServerSecurityLevel(target).toFixed(1)} / ${securityThresh}
    ---------------------------------------`);
  }
  if (ns.getServerMoneyAvailable(target) < 0.50 * serverMaxMoney) ns.tprint(`${target} is now HACKED, ready to grow.`);
  if (ns.getServerSecurityLevel(target) > securityThresh) ns.tprint(`ENDING EARLY: ${target} past security threshold. Current: ${ns.getServerSecurityLevel(target)}, Target: ${securityThresh}`);
  await ns.write(`/notifications/${target}.notification.txt`, `{"host": "${target}", "status": "hacked"}`, 'w');
}