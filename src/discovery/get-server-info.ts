/** @param {import("..").NS } ns */
export async function main(ns) {
  const i = ns.args[0] || 0;
  const connectedServers = await ns.scan();
  if (i > 0) connectedServers.shift();
  let allServerInfo = '';
  for (const server of connectedServers) {
    const serverInfo = ns.getServer(server);
    if (allServerInfo.length === 0) {
      allServerInfo = allServerInfo.concat(
        // eslint-disable-next-line no-return-assign
        Object.keys(serverInfo).reduce((header, key) => header += `| ${key.padEnd(15, ' ')}|`, ''),
        '\r\n',
      );
    }
    // eslint-disable-next-line no-return-assign
    allServerInfo = allServerInfo.concat(Object.keys(serverInfo).reduce((info, key) => info += `| ${serverInfo[key].toString().padEnd(15, ' ')}|`, ''), '\r\n');
  }
  ns.write('server-info.txt', allServerInfo, 'w');
}
