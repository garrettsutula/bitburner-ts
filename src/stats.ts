import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
  const doc = eval('document');
  const hook0 = doc.getElementById('overview-extra-hook-0');
  const hook1 = doc.getElementById('overview-extra-hook-1');
  while (true) {
      try {
          const headers = []
          const values = [];

          if (ns.gang.inGang()) {
              if (ns.gang.getGangInformation()['moneyGainRate'] > 0) {
                  headers.push("Gang Income: ");
                  values.push('   ' + ns.nFormat((5 * ns.gang.getGangInformation()['moneyGainRate']), '$0,0') + ' /s');
              }
          }

          if (ns.getScriptIncome()[0] > 0) {
              headers.push('Hack Income: ');
              const args: string[] = []
              values.push('   ' + ns.nFormat(ns.getScriptIncome('scheduler.js', 'home', ...args), '$0,0') + ' /s')
              headers.push('Stock Income: ');
              values.push('   ' + ns.nFormat(ns.getScriptIncome('trader.js', 'home', ...args), '$0,0') + ' /s')
            }

          headers.push('HOME Ram Use: ')
          values.push(ns.nFormat(ns.getServerUsedRam('home'), '0,0') + ' / ' + ns.nFormat(ns.getServerMaxRam('home'), '0,0'))

          headers.push('-------------')
          values.push('--------------------------------------')

          headers.push(ns.getPlayer()['city'])
          values.push(ns.getPlayer()['location'])

          hook0.innerText = headers.join(" \n");
          hook1.innerText = values.join("\n");
      } catch (err) {
          ns.print("ERROR: Update Skipped: " + String(err));
      }
      await ns.sleep(500);
  }
}
