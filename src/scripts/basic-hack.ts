import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
const target = ns.args[0] as string;

const moneyThresh = ns.getServerMaxMoney(target) * 0.75;
const securityThresh = ns.getServerMinSecurityLevel(target) + 5;

while(true) {
    if (ns.getServerSecurityLevel(target) > securityThresh) {
        // If the server's security level is above our threshold, weaken it
        await ns.weaken(target);
    } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
        // If the server's money is less than our threshold, grow it
        await ns.grow(target);
    } else {
        // Otherwise, hack it
        await ns.hack(target);
    }
}
}