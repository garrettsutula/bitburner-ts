/** @param {import("..").NS } ns */
export async function main(ns) {
  const purchasedServers = ns.getPurchasedServers();
  purchasedServers.forEach((server) => {
    ns.killall(server);
    ns.deleteServer(server);
  });
}
