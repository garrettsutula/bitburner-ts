/** @param {import("..").NS } ns */
export async function main(ns) {
  const [target] = ns.args;
  while (true) {
    await ns.grow(target);
  }
}
