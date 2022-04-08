import { NS } from '@ns'

export function execa(ns : NS, fileName: string, hostName: string, threads = 1, ...restArgs: any[]) : number {
  return ns.exec(fileName, hostName, threads, ...restArgs);
}

export function kill(ns: NS, host: string, script: string, args: any[]) {
  return ns.kill(host, script, ...args);
}