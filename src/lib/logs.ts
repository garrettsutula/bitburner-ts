import { NS } from '@ns';

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
}
