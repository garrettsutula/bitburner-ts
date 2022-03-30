import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const [fileName, hostName, threads = 1, ...restArgs] = args;
  await ns.scp(fileName, 'home', hostName);
  return ns.exec(fileName, hostName, threads, ...restArgs);
}