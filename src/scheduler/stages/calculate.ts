import { NS } from '@ns'
import { ProcedureStep } from '/models/procedure';
import { calculationParameters } from '/scheduler/config';

const { throttleRatio, hackPercentage, stepBuffer, prepareGrowPercentage } = calculationParameters;

export function calculateWeaken(ns: NS, ordinal: number, host: string, script: string, securityLevelDecrease?: number): ProcedureStep {
  const duration = ns.getWeakenTime(host);
  const currentSecurity = ns.getServerSecurityLevel(host);
  const minLevel = ns.getServerMinSecurityLevel(host);
  const securityLevel = securityLevelDecrease || currentSecurity - minLevel;
  const threadsNeeded = Math.ceil((securityLevel * 1.10) / (0.05 * throttleRatio));
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  if (ramNeeded === Infinity) {
    console.log('wtf');
  }
  return { ordinal, script, duration, threadsNeeded, ramNeeded }
}

export function calculateGrow(ns: NS, ordinal: number, host: string, script: string, prepare = false): ProcedureStep {
  const duration = calculateGrowTime(ns, host);
  const maxMoney = ns.getServerMaxMoney(host);
  const growthFactor = ((throttleRatio * maxMoney * (1 + hackPercentage + 0.20)) / (maxMoney)) + 1;
  // TODO: pass cores as param
  const threadsNeeded = Math.ceil(ns.growthAnalyze(host, prepare ? prepareGrowPercentage : growthFactor , 1));
  const securityLevelIncrease = ns.growthAnalyzeSecurity(threadsNeeded);
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  if (ramNeeded === Infinity) {
    console.log('wtf');
  }
  return { ordinal, script, duration, threadsNeeded, ramNeeded, securityLevelIncrease }
}
 
export function calculateHack(ns: NS, ordinal: number, host: string, script: string): ProcedureStep {
  const duration = calculateHackTime(ns, host);
  const maxMoney = ns.getServerMaxMoney(host);
  // TODO: pass cores as param
  const threadsNeeded = calculateHackThreads(ns, host, (maxMoney * 0.98) * hackPercentage * throttleRatio);
  const securityLevelIncrease = ns.hackAnalyzeSecurity(threadsNeeded);
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  if (ramNeeded === Infinity) {
    console.log('wtf');
  }
  return { ordinal, script, duration, threadsNeeded, ramNeeded, securityLevelIncrease }
}

export function calculateHackDelay(ns: NS, host: string): number {
  return ns.getWeakenTime(host) - calculateHackTime(ns, host, true) - stepBuffer;
}

export function calculateGrowDelay(ns: NS, host: string): number {
  return ns.getWeakenTime(host) - calculateGrowTime(ns, host) + stepBuffer;
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
  const bitnodeMultiplier = 1 // WARN: CHANGE ME, THIS IS FOR BITNODE 4
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

function calculateHackTime(ns: NS, host: string, inMs = false) {
  const {minDifficulty: hackDifficulty, requiredHackingSkill} = ns.getServer(host);
  const { hacking: playerHackingLevel, hacking_speed_mult} = ns.getPlayer();
  const difficultyMult = requiredHackingSkill * hackDifficulty;

  const baseDiff = 500;
  const baseSkill = 50;
  const diffFactor = 2.5;
  let skillFactor = diffFactor * difficultyMult + baseDiff;
  // tslint:disable-next-line
  skillFactor /= playerHackingLevel + baseSkill;

  const hackTimeMultiplier = 5;
  const hackingTime =
    (hackTimeMultiplier * skillFactor) /
    (hacking_speed_mult * 1);
  if (inMs) return hackingTime * 1000;
  return hackingTime;
}

function calculateWeakenTime(ns: NS, host: string) {
  return calculateHackTime(ns, host) * 4 * 1000;
}

function calculateGrowTime(ns: NS, host: string) {
  return calculateHackTime(ns, host) * 3.2 * 1000;
}