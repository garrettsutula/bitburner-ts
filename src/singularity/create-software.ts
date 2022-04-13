import { NS } from '@ns'



export async function main(ns : NS) : Promise<void> {
  function can(action: string) {
    return ns.fileExists(`${action}.exe`, 'home');
  }

  const needToCreate = [];
  if (!can('autolink')) needToCreate.push('AutoLink.exe');
  if (!can('brutessh'))  needToCreate.push('BruteSSH.exe');
  if (!can('serverprofiler')) needToCreate.push('ServerProfiler.exe');
  if (!can('deepscanv1')) needToCreate.push('DeepscanV1.exe');
  if (!can('ftpcrack'))  needToCreate.push('FTPCrack.exe');
  if (!can('relaysmtp')) needToCreate.push('relaySMTP.exe');
  if (!can('deepscanv2')) needToCreate.push('DeepscanV2.exe');
  if (!can('httpworm')) needToCreate.push('HTTPWorm.exe');
  if (!can('sqlinject')) needToCreate.push('SQLInject.exe');

  while (needToCreate.length > 0) {
    const program = needToCreate.shift() as string;
    const isNowCreating = ns.createProgram(program, true);
    if (isNowCreating) {
      while(ns.isBusy()) await ns.sleep(100);
    } else {
      needToCreate.push(program);
      await ns.sleep(2500);
    }
  }
  ns.run('/crimes/mug.js');
}