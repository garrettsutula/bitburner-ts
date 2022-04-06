import { NS } from '@ns'
const foundPaths: string[] = [];

function recursiveScan(ns: NS, host: string, targetHost: string, networkSignature: string, seen: string[] = []): any {
  networkSignature += `${networkSignature.length ? '.' : ''}${host}`;
  if (host === targetHost) {
    foundPaths.push(networkSignature);
  }
  if (!seen.includes(host)) {
    seen.push(host);
    return ns.scan(host)
      .map((childHost: string) => recursiveScan(ns, childHost, targetHost, networkSignature, seen));
  }
  return null
}

export async function main(ns : NS) : Promise<void> {
  foundPaths.length = 0;
  const targetHost = ns.args[0].toString();
  recursiveScan(ns, 'home', targetHost, '');
  ns.tprint(`Found paths to host:
  ${foundPaths.join('\n')}
  `);
}