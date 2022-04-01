import { NS } from '@ns'
import { ProcedureStep } from '/models/procedure';
const hackPercentage = 0.50;

export function calculateWeaken(ns: NS, host: string, script: string, securityLevelDecrease?: number): ProcedureStep {
  const duration = ns.getWeakenTime(host);
  const securityLevel = securityLevelDecrease || ns.getServerSecurityLevel(host) - ns.getServerMinSecurityLevel(host);
  const threadsNeeded = securityLevel / 0.05;
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  return { script, duration, threadsNeeded, ramNeeded }
}

export function calculateGrow(ns: NS, host: string, script: string): ProcedureStep {
  const duration = ns.getGrowTime(host);
  const maxMoney = ns.getServerMaxMoney(host);
  // TODO: pass cores as param
  const threadsNeeded = ns.growthAnalyze(host, maxMoney * hackPercentage * 1.01, 1); 
  const securityLevelIncrease = ns.growthAnalyzeSecurity(threadsNeeded);
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  return { script, duration, threadsNeeded, ramNeeded, securityLevelIncrease }
}

export function calculateHack(ns: NS, host: string, script: string): ProcedureStep {
  const duration = ns.getHackTime(host);
  const maxMoney = ns.getServerMaxMoney(host);
  // TODO: pass cores as param
  const threadsNeeded = ns.hackAnalyzeThreads(host, maxMoney * hackPercentage);
  const securityLevelIncrease = ns.hackAnalyzeSecurity(threadsNeeded);
  const ramNeeded = ns.getScriptRam(script) * threadsNeeded;
  return { script, duration, threadsNeeded, ramNeeded, securityLevelIncrease }
}

export function calculateStepsRamNeeded(steps: ProcedureStep[]): number {
  return steps.reduce((acc, { ramNeeded }): number => acc + ramNeeded, 0);
}

export function calculateStepsDuration(steps: ProcedureStep[]): number {
  return steps.reduce((acc, { duration }): number => acc + duration, 0);
}