/** @param {import("..").NS } ns */
export async function execa(ns, args) {
  const [fileName, hostName, threads = 1, ...restArgs] = args;
  await ns.scp(fileName, 'home', hostName);
  return ns.exec(fileName, hostName, threads, ...restArgs);
}
