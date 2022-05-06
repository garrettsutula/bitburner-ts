import { NS } from '@ns';
const foundPaths: string[] = [];

function recursiveScan(ns: NS, host: string, targetHost: string, networkSignature: string, seen: string[] = []): any {
  networkSignature += `${networkSignature.length ? '|' : ''}${host}`;
  if (host === targetHost) {
    foundPaths.push(networkSignature);
  }
  if (!seen.includes(host)) {
    seen.push(host);
    return ns.scan(host)
      .map((childHost: string) => recursiveScan(ns, childHost, targetHost, networkSignature, seen));
  }
  return null;
}

export async function main(ns : NS) : Promise<void> {
  foundPaths.length = 0;
  const targetHost = ns.args[0].toString();
  recursiveScan(ns, 'home', targetHost, '');
  if (foundPaths.length === 0) {
    ns.tprint(`No known path to: ${targetHost}`);
    return;
  }
  const path = foundPaths[0].split('|');
  path.forEach((hop: string) => ns.connect(hop))
  await ns.installBackdoor();
  ns.connect('home');
}