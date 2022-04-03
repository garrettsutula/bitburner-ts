import { NS } from '@ns'
import { ProcedureStep } from '/models/procedure';
const throttleRatio = 1;
const hackPercentage = 0.10;
const stepBuffer = 75;

export function calculateWeaken(ns: NS, ordinal: number, host: string, script: string, securityLevelDecrease?: number): ProcedureStep {
  const duration = ns.getWeakenTime(host);
  const currentSecurity = ns.getServerSecurityLevel(host);
  const minLevel = ns.getServerMinSecurityLevel(host);
  const securityLevel = securityLevelDecrease || currentSecurity - minLevel;
  const threadsNeeded = Math.ceil(securityLevel / 0.05 * throttleRatio);
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  return { ordinal, script, duration, threadsNeeded, ramNeeded }
}

export function calculateGrow(ns: NS, ordinal: number, host: string, script: string, prepare = false): ProcedureStep {
  const duration = ns.getGrowTime(host);
  const maxMoney = ns.getServerMaxMoney(host);
  const growthFactor = ((maxMoney * hackPercentage * 1.05) / (maxMoney * throttleRatio)) + 1;
  // TODO: pass cores as param
  // TODO: fix the magic ratio here, we have been overhacking and this is temp fix
  const threadsNeeded = Math.ceil(ns.growthAnalyze(host, growthFactor < 1 ? 1.05 : growthFactor, 1));
  const securityLevelIncrease = ns.growthAnalyzeSecurity(threadsNeeded);
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  return { ordinal, script, duration, threadsNeeded, ramNeeded, securityLevelIncrease }
}

export function calculateHack(ns: NS, ordinal: number, host: string, script: string): ProcedureStep {
  const duration = ns.getHackTime(host);
  const moneyAvailable = ns.getServerMoneyAvailable(host);
  // TODO: pass cores as param
  // TODO fix magic ratios here, we have been over-hacking and putting the host in a bad state
  const threadsNeeded = calculateHackThreads(ns, host, moneyAvailable * hackPercentage * throttleRatio * 0.5);
  const securityLevelIncrease = ns.hackAnalyzeSecurity(threadsNeeded);
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  return { ordinal, script, duration, threadsNeeded, ramNeeded, securityLevelIncrease }
}

export function calculateHackDelay(ns: NS, host: string): number {
  return ns.getWeakenTime(host) - ns.getHackTime(host) - stepBuffer;
}

export function calculateGrowDelay(ns: NS, host: string): number {
  return ns.getWeakenTime(host) - ns.getGrowTime(host) + stepBuffer;
}

export function calculateWeakenDelay(ns: NS, host: string, stepNumber: number): number {
  return stepBuffer * (stepNumber - 2);
}

export function calculateStepsRamNeeded(steps: ProcedureStep[]): number {
  return steps.reduce((acc, { ramNeeded }): number => acc + ramNeeded, 0);
}

export function calculateStepsDuration(steps: ProcedureStep[]): number {
  const longestDurationStep = steps
  .reduce((longest, curr) => longest.duration > curr.duration ? longest : curr, {duration: 0} as ProcedureStep);
  return longestDurationStep.duration + (stepBuffer * longestDurationStep.ordinal);
}

function calculateHackThreads(ns: NS, host: string, hackAmount: number) {
  const balanceFactor = 240;
  const bitnodeMultiplier = 0.2 // WARN: CHANGE ME, THIS IS FOR BITNODE 4
  const currentMoney = ns.getServerMoneyAvailable(host);
  const hackDifficulty = ns.getServerSecurityLevel(host);
  const difficultyMultiplier = (100 - hackDifficulty) / 100;
  const hackingLevel = ns.getHackingLevel();
  const requiredHackingLevel = ns.getServerRequiredHackingLevel(host);
  const skillMultiplier = (hackingLevel - (requiredHackingLevel - 1)) / hackingLevel;
  const {money: moneyMultiplier} = ns.getHackingMultipliers();
  let percentMoneyHackedOneThread = (difficultyMultiplier * skillMultiplier * moneyMultiplier * bitnodeMultiplier) / balanceFactor;
  if ( percentMoneyHackedOneThread < 0) percentMoneyHackedOneThread = 0;
  if ( percentMoneyHackedOneThread > 1 ) percentMoneyHackedOneThread = 1;
  if ( percentMoneyHackedOneThread === 0 || currentMoney === 0) return 0;
  return hackAmount / Math.floor(currentMoney * percentMoneyHackedOneThread);
}
