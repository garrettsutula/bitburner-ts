import { Server } from '@ns'
import { formatNumberShort } from '/helpers';

export interface ControlledServers {
  host: string
  availableRam: number;
}

export interface ServerNotification {
  host: string;
  status: 'recycle' | 'rooted' | 'weakened' | 'grown' | 'hacked';
}

export class ServerStats {
  name: string;
  owned: boolean;
  root: boolean;
  reqHack: number;
  reqPorts: number;
  cores: number;
  ram: number;
  ramUsed: number;
  sec: number;
  minSec: number;
  pctOverMin: number;
  money: number;
  moneyShort: string;
  moneyMax: number;
  moneyMaxShort: string;
  pctMoneyMax: number;
  growMult: number;

  constructor (server: Server) {
    this.name = server.hostname;
    this.owned = server.purchasedByPlayer;
    this.root = server.hasAdminRights;
    this.reqHack = server.requiredHackingSkill;
    this.reqPorts = server.numOpenPortsRequired;
    this.cores = server.cpuCores;
    this.ram = server.maxRam;
    this.ramUsed = server.ramUsed;
    this.sec = parseFloat(server.hackDifficulty.toFixed(1));
    this.minSec = server.minDifficulty;
    this.pctOverMin = parseFloat(((server.hackDifficulty / server.minDifficulty) * 100).toFixed(1));
    this.money = parseInt(server.moneyAvailable.toFixed(0));
    this.moneyShort = formatNumberShort(server.moneyAvailable, 6, 0);
    this.moneyMax = server.moneyMax;
    this.moneyMaxShort = formatNumberShort(server.moneyMax, 6, 0);
    this.pctMoneyMax = parseFloat(((server.moneyAvailable / server.moneyMax) * 100).toFixed(1))
    this.growMult = server.serverGrowth;
  }
}


export function percentMaxMoney(ns: NS, host: string): string {
  return ((ns.getServerMoneyAvailable(host) / ns.getServerMaxMoney(host)) * 100).toFixed(2);
}

export function percentMaxMoneyNum(ns: NS, host: string): number {
  return ((ns.getServerMoneyAvailable(host) / ns.getServerMaxMoney(host)) * 100);
}

export function percentOverMinSecurity(ns: NS, host: string): string {
  const minSecurity = ns.getServerMinSecurityLevel(host);
  const currentSecurity = ns.getServerSecurityLevel(host);
  return (((currentSecurity/minSecurity) * 100) - 100).toFixed(1);
}