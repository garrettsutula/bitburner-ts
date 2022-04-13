import { NS } from '@ns'

function cityName(initial: string) {
  switch(initial) {
    case 's':
    case 'S':
      return "Sector-12";
    case 'a':
    case 'A':
      return 'Aevum';
    case 'v':
    case 'V':
      return 'Volhaven';
    case 'c':
    case 'C':
      return 'Chongqing';
    case 'n':
    case 'N':
      return 'New Tokyo'
    case 'i':
    case 'I':
      return 'Ishima';
    default:
      return null;
  }
}

export async function main(ns : NS) : Promise<void> {
  const cityInitial = ns.args[0] as string;
  const name = cityName(cityInitial);
  if (name) {
    ns.travelToCity(name);
  } else {
    ns.tprint(`City initial: ${cityInitial} unrecognized. Accepted values: s, a, v, c, n, i`);
  }
}