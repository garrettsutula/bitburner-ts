/** @param {import("..").NS } ns */
export async function main(ns) {
  ns.disableLog('disableLog');
  ns.disableLog('getServerMaxMoney');
  ns.disableLog('getServerMoneyAvailable');
  ns.disableLog('getServerMinSecurityLevel');
  ns.disableLog('getServerSecurityLevel');
  ns.disableLog('sleep');
  const [target] = ns.args;
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
