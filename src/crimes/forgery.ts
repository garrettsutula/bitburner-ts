import { NS } from '@ns'
import { disableLogs } from '/lib/logs';

export async function main(ns: NS): Promise<void> {
  while (true) {
    ns.tail();
    disableLogs(ns);
    ns.commitCrime('bond forgery');
    while(ns.isBusy()) {
      await ns.sleep(50);
    }
  }
}
