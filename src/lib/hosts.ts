import { NS } from '@ns';
import { ControlledServers } from '/models/server';
import { schedulerParameters } from '/config';

export function getControlledHostsWithMetadata(ns: NS, hosts: string[]): ControlledServers[] {
  return hosts.map((host) => {
    let availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
    if (host === 'home') availableRam = availableRam - schedulerParameters.reserveHomeRamGb;
    return {
      host,
      availableRam,
    };
  });
}

export function getHostWithMostRam(ns: NS, hosts: string[]): { host: string, availableRam: number } {
  let highestAvailableRam = 0;
  let highestHost = '';
  const availableRam = hosts.map((host) => ns.getServerMaxRam(host) - ns.getServerUsedRam(host));
  hosts.forEach((host, i) => {
    if (highestAvailableRam < availableRam[i]) {
      highestAvailableRam = availableRam[i]
      highestHost = host;
    }
  })
  return { host: highestHost, availableRam: highestAvailableRam };
}