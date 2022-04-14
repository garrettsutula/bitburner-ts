import { NS } from '@ns'
import { ProcedureStep } from '/models/procedure';
import { calculationParameters } from '/config';

const { throttleRatio, hackPercentage, stepBuffer, prepareGrowthFactor } = calculationParameters;

export function calculateWeaken(ns: NS, ordinal: number, host: string, script: string, securityLevelDecrease?: number): ProcedureStep {
  const duration = ns.getWeakenTime(host);
  const currentSecurity = ns.getServerSecurityLevel(host);
  const minLevel = ns.getServerMinSecurityLevel(host);
  const securityLevel = securityLevelDecrease || currentSecurity - minLevel;
  const threadsNeeded = Math.ceil((securityLevel * 1.10) / (0.05 * throttleRatio));
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  return { ordinal, script, duration, threadsNeeded, ramNeeded }
}

export function calculateGrow(ns: NS, ordinal: number, host: string, script: string, prepare = false): ProcedureStep {
  const duration = ns.getGrowTime(host);
  const growthFactor = 1 / (1-hackPercentage-0.05);
  // TODO: pass cores as param
  const threadsNeeded = Math.ceil(ns.growthAnalyze(host, prepare ? prepareGrowthFactor : growthFactor , 1));
  const securityLevelIncrease = ns.growthAnalyzeSecurity(threadsNeeded);
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  return { ordinal, script, duration, threadsNeeded, ramNeeded, securityLevelIncrease }
}
 
export function calculateHack(ns: NS, ordinal: number, host: string, script: string): ProcedureStep {
  const duration = ns.getHackTime(host);
  const maxMoney = ns.getServerMaxMoney(host);
  // TODO: pass cores as param
  const threadsNeeded = calculateHackThreads(ns, host, (maxMoney * 0.98) * hackPercentage * throttleRatio);
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
  const bitnodeMultiplier = ns.getBitNodeMultipliers().HackingLevelMultiplier;
  const currentMoney = ns.getServerMaxMoney(host);
  const hackDifficulty = ns.getServerMinSecurityLevel(host);
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
