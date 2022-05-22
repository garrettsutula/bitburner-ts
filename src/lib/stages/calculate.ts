import { NS, BitNodeMultipliers, Player } from '@ns'
import { ProcedureStep } from '/models/procedure';
import { calculationParameters } from '/config';
import { readJson } from '/lib/file';

const { hackPercentage, stepBuffer, prepareGrowthFactor } = calculationParameters;

export function calculateWeaken(ns: NS, ordinal: number, host: string, script: string, securityLevelDecrease?: number, prepare = false): ProcedureStep {
  const duration = ns.getWeakenTime(host);
  const currentSecurity = ns.getServerSecurityLevel(host);
  const minLevel = ns.getServerMinSecurityLevel(host);
  const securityLevel = securityLevelDecrease || currentSecurity - minLevel;
  const threadsNeeded = Math.max(prepare ? (prepareGrowthFactor - 1)/0.05 : Math.ceil((securityLevel * 1.05) / (0.05)), 1);
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  return { task: 'weaken', ordinal, script, duration, threadsNeeded, ramNeeded, delay: 0 }
}

export function calculateGrow(ns: NS, ordinal: number, host: string, script: string, prepare = false): ProcedureStep {
  const duration = ns.getGrowTime(host);
  const maxMoney = ns.getServerMaxMoney(host);
  const growthFactor = prepare ? prepareGrowthFactor : maxMoney / (maxMoney * (1 - hackPercentage));
  // TODO: pass cores as param
  let threadsNeeded = 0;
  if (ns.formulas) {
    const growthOneThread = ns.formulas.hacking.growPercent(ns.getServer(host), 1, ns.getPlayer());
    threadsNeeded = Math.ceil((growthFactor - 1) / (growthOneThread - 1));
  } else {
    threadsNeeded = Math.ceil(ns.growthAnalyze(host, growthFactor , 1));
  }
  const securityLevelIncrease = ns.growthAnalyzeSecurity(threadsNeeded);
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  
  return { task: 'grow', ordinal, script, duration, threadsNeeded, ramNeeded, securityLevelIncrease, delay: 0 }
}
 
export function calculateHack(ns: NS, ordinal: number, host: string, script: string): ProcedureStep {
  const duration = ns.getHackTime(host);
  const maxMoney = ns.getServerMaxMoney(host);
  // TODO: pass cores as param
  let threadsNeeded = 0;
  if (ns.formulas) {
    threadsNeeded = Math.ceil(hackPercentage / ns.formulas.hacking.hackPercent(ns.getServer(host), ns.getPlayer()));
  } else {
    threadsNeeded = calculateHackThreads(ns, host, (maxMoney * 0.98) * hackPercentage);
  }
  
  const securityLevelIncrease = ns.hackAnalyzeSecurity(threadsNeeded);
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  return { task: 'hack', ordinal, script, duration, threadsNeeded, ramNeeded, securityLevelIncrease, delay: 0 }
}

export function calculateHackDelay(ns: NS, host: string): number {
  return ns.getWeakenTime(host) - ns.getHackTime(host) - stepBuffer;
}

export function calculateGrowDelay(ns: NS, host: string): number {
  return ns.getWeakenTime(host) - ns.getGrowTime(host) + stepBuffer;
}

export function calculateWeakenDelay(ns: NS, host: string, bufferMultiplier: number): number {
  return stepBuffer * bufferMultiplier;
}

export function calculateStepsRamNeeded(steps: ProcedureStep[]): number {
  return steps.reduce((acc, { ramNeeded }): number => acc + ramNeeded, 0);
}

export function calculateStepsDuration(steps: ProcedureStep[]): number {
  const longestDurationStep = steps
  .reduce((longest, curr) => longest.duration > curr.duration ? longest : curr, {duration: 0} as ProcedureStep);
  return longestDurationStep.duration + (stepBuffer * (steps.length - 1));
}

function calculateHackThreads(ns: NS, host: string, hackAmount: number) {
  const balanceFactor = 240;
  const bitnodeMultiplier = (readJson(ns, '/data/bitnodeInfo.txt') as BitNodeMultipliers).HackingLevelMultiplier;
  const currentMoney = ns.getServerMaxMoney(host);
  const hackDifficulty = ns.getServerMinSecurityLevel(host);
  const difficultyMultiplier = (100 - hackDifficulty) / 100;
  const hackingLevel = ns.getHackingLevel();
  const requiredHackingLevel = ns.getServerRequiredHackingLevel(host);
  const skillMultiplier = (hackingLevel - (requiredHackingLevel - 1)) / hackingLevel;
  const moneyMultiplier = (readJson(ns, '/data/playerInfo.txt') as Player).hacking_money_mult;
  let percentMoneyHackedOneThread = (difficultyMultiplier * skillMultiplier * moneyMultiplier * bitnodeMultiplier) / balanceFactor;
  if ( percentMoneyHackedOneThread < 0) percentMoneyHackedOneThread = 0;
  if ( percentMoneyHackedOneThread > 1 ) percentMoneyHackedOneThread = 1;
  if ( percentMoneyHackedOneThread === 0 || currentMoney === 0) return 0;
  return hackAmount / Math.floor(currentMoney * percentMoneyHackedOneThread);
}
