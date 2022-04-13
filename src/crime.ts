import { NS } from '@ns'
import { disableLogs } from '/lib/logger';

function getCrime(param: string): string {
  switch(param) {
    case 'b':
    case 'B':
    case 'bond':
      return 'bond forgery';
    case 'd':
    case 'D':
    case 'drug':
    case 'drugs':
      return 'deal drugs';
    case 'gta':
      return 'grand theft auto';
    case 'he':
    case 'heist':
      return 'heist';
    case 'ho':
    case 'hom':
    case 'homicide':
      return 'homicide';
    case 'm':
    default:
      return 'mug';
    case 'r':
    case 'R':
    case 'rob':
      return 'rob store';
    case 's':
    case 'S':
      return 'shoplift';
  }
}

async function doCrime(ns: NS, crime: string): Promise<void> {
  ns.tail();
  
  ns.commitCrime('bond forgery');
  while(ns.isBusy()) {
    await ns.sleep(50);
  }
}

export async function main(ns : NS) : Promise<void> {
  disableLogs(ns);
  const [crimeParam] = ns.args[0] as string;
  await doCrime(ns, getCrime(crimeParam));
}