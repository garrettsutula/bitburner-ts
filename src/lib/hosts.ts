import { NS } from '@ns';
import { ControlledServers } from '/models/server';

export function getControlledHostsWithMetadata(ns: NS, hosts: string[]): ControlledServers[] {
  return hosts.map((host) => {
    const availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
    return {
      host,
      availableRam,
    };
  });
}