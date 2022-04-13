import { NS } from '@ns'
import { disableLogs } from '/lib/logs';

export async function main(ns: NS): Promise<void> {
  while (true) {
    ns.tail();
    disableLogs(ns);
    ns.commitCrime('grand theft auto');
    while(ns.isBusy()) {
      await ns.sleep(50);
    }
  }
}
