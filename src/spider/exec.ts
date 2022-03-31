import { NS } from '@ns'

export async function execa(ns : NS, fileName: string, hostName: string, threads = 1, ...restArgs: any[]) : Promise<number> {
  await ns.scp(fileName, 'home', hostName);
  return ns.exec(fileName, hostName, threads, ...restArgs);
}