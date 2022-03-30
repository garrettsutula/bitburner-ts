/** @param {import("..").NS } ns */
export async function main(ns) {
  ns.disableLog('disableLog');
  ns.disableLog('getServerMinSecurityLevel');
  ns.disableLog('getServerSecurityLevel');
  ns.disableLog('sleep');
  const [target] = ns.args;
  const initialSecurityLevel = ns.getServerSecurityLevel(target);
  const securityThresh = ns.getServerMinSecurityLevel(target) + 3;
  while ((ns.getServerSecurityLevel(target) > securityThresh)) {
    await ns.sleep(10000);
    ns.print(`\tProgress: ${(((ns.getServerSecurityLevel(target) - securityThresh) / (initialSecurityLevel - securityThresh)) * 100).toFixed(2)}%
    Desired Security Level: ${securityThresh}
    Current Security Level: ${ns.getServerSecurityLevel(target)}
    ---------------------------------------`);
  }
  ns.tprint(`${target} is now WEAK, ending dedicated weaken process.`);
  await ns.write(`/notifications/${target}.notification.txt`, `{"host": "${target}", "status": "weakened"}`, 'w');
}
