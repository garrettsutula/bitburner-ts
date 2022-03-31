import { NS } from '@ns'
const foundPaths = [];
const seen = [];

function recursiveScan(ns, host, targetHost, networkSignature) {
  networkSignature += `${networkSignature.length ? '.' : ''}${host}`;
  if (host === targetHost) {
    foundPaths.push(networkSignature);
  }
  if (!seen.includes(host)) {
    seen.push(host);
    return ns.scan(host)
      .map((childHost) => recursiveScan(ns, childHost, targetHost, networkSignature));
  }
  return null;
}



export async function main(ns : NS) : Promise<void> {
  const [targetHost] = ns.args;
  recursiveScan(ns, 'home', targetHost, '');
  ns.tprint(`Found paths to host:
  ${foundPaths.join('\n')}
  `);
}