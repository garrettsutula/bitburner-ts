const foundFiles = {};
let seen = [];
const ignoreFilePaths = [
  '/spider/spider_hacked_hosts.txt',
  'spider_data.txt',
  'foundFiles.txt',
  'file-list.txt',
];

/** @param {import("..").NS } ns */
function recursiveScan(ns, host) {
  const filePaths = ns.ls(host);
  const specialFiles = filePaths
    .filter((filePath) => (!filePath.includes('.js') && !filePath.includes('.exe') && !ignoreFilePaths.includes(filePath)));
  if (specialFiles.length) foundFiles[host] = `*****Server: ${host}\n\t${specialFiles.join('\n\t')}`;
  if (!seen.includes(host)) {
    seen.push(host);
    return ns.scan(host).map((childHost) => recursiveScan(ns, childHost));
  }
  return null;
}

/** @param {import("..").NS } ns */
export async function main(ns) {
  seen = ['darkweb'].concat(ns.getPurchasedServers());
  recursiveScan(ns, 'home');
  ns.tprint(`${Object.keys(foundFiles).length} hosts with interesting files`);
  await ns.write('foundFiles.txt', Object.values(foundFiles).join('\n\n'), 'w');
}
