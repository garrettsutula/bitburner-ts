import { NS } from '@ns';
import { readJson, writeJson } from '/lib/file';

export async function main(ns: NS): Promise<void> {
  const baseName = "gserv-";
  let multi = 19; // assumes you need up to 8gb for your hack and distro script. you may be able to lower this accordingly.

  const servers = ns.getPurchasedServers();

  const queue = new Queue();
  for (let i = 0; i < servers.length; i++) {
      queue.enqueue(servers[i]);
  }

  let nameCounter = 1;
  const maxRam = Math.pow(2, 20);
  while (true) {
      if (Math.pow(2, multi) >= maxRam) {
          ns.tprint("maxed on servers, killing process");
          return;
      }
      await ns.sleep(50);
      const count = queue.length;
      const cash = ns.getPlayer().money;
      const ram = Math.min(Math.pow(2, 20), Math.pow(2, multi));
      const cost = ns.getPurchasedServerCost(ram);

      if (count >= ns.getPurchasedServerLimit() && cash >= cost) {
          let current = queue.peek();
          if (Math.min(maxRam, Math.pow(2, multi)) <= ns.getServerMaxRam(current)) {
              ns.tprint("bumping ram multi from " + multi + " to " + (multi + 1));
              multi++;
              continue;
          }
          else {
              current = queue.dequeue();
              const controlledHosts = readJson(ns, '/data/controlledHosts.txt') as string[];
              await writeJson(ns, '/data/controlledHosts.txt', controlledHosts.filter((host) => host !== current));
              ns.killall(current);
              ns.deleteServer(current);
          }
      }
      else if (count < ns.getPurchasedServerLimit() && cash >= cost) {
          const name = baseName + nameCounter;
          nameCounter++;
          const newBox = ns.purchaseServer(name, ram);
          queue.enqueue(newBox);
          await ns.asleep(120000);
      }
  }
}

class Queue extends Array {
  enqueue(val: string) {
      this.push(val);
  }

  dequeue() {
      return this.shift();
  }

  peek() {
      return this[0];
  }

  isEmpty() {
      return this.length === 0;
  }
}