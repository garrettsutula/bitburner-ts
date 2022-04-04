export function getSymbolServer(symbol: string): string {
  const symServer: {[key: string]: string} = {
      "WDS": "",
      "ECP": "ecorp",
      "MGCP": "megacorp",
      "BLD": "blade",
      "CLRK": "clarkinc",
      "OMTK": "omnitek",
      "FSIG": "4sigma",
      "KGI": "kuai-gong",
      "DCOMM": "defcomm",
      "VITA": "vitalife",
      "ICRS": "icarus",
      "UNV": "univ-energy",
      "AERO": "aerocorp",
      "SLRS": "solaris",
      "GPH": "global-pharm",
      "NVMD": "nova-med",
      "LXO": "lexo-corp",
      "RHOC": "rho-construction",
      "APHE": "alpha-ent",
      "SYSC": "syscore",
      "CTK": "comptek",
      "NTLK": "netlink",
      "OMGA": "omega-net",
      "JGN": "joesguns",
      "SGC": "sigma-cosmetics",
      "CTYS": "catalyst",
      "MDYN": "microdyne",
      "TITN": "titan-labs",
      "FLCM": "fulcrumtech",
      "STM": "stormtech",
      "HLS": "helios",
      "OMN": "omnia",
      "FNS": "foodnstuff"
  }

  return symServer[symbol];
}