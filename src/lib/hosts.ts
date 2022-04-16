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