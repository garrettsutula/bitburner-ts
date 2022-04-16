import { NS } from '@ns';

function travelbatch(ns: NS) {
  let count = 0
  while (count < 10000) {
    ns.travelToCity('Chongqing');
    ns.travelToCity('Ishima');
    count +=1;
  }
}

export async function main(ns : NS) : Promise<void> {
  while(true) {
    travelbatch(ns);
    await ns.sleep(15);
  }
}