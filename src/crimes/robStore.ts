/** @param {NS} ns * */
export async function main(ns) {
  let counter = 1;
  while (true) {
    ns.commitCrime('rob store');
    await ns.sleep(62000);
    counter += 1;
  }
}
