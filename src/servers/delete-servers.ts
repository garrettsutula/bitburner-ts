import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const purchasedServers = ns.getPurchasedServers();
  purchasedServers.forEach((server) => {
    ns.killall(server);
    ns.deleteServer(server);
  });
}
