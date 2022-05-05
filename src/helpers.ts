/**
 * Return a formatted representation of the monetary amount using scale symbols (e.g. $6.50M)
 * @param {number} num - The number to format
 * @param {number=} maxSignificantFigures - (default: 6) The maximum significant figures you wish to see (e.g. 123, 12.3 and 1.23 all have 3 significant figures)
 * @param {number=} maxDecimalPlaces - (default: 3) The maximum decimal places you wish to see, regardless of significant figures. (e.g. 12.3, 1.2, 0.1 all have 1 decimal)
 **/
 export function formatMoney(num: number, maxSignificantFigures = 6, maxDecimalPlaces = 3): string {
  const numberShort = formatNumberShort(num, maxSignificantFigures, maxDecimalPlaces);
  return num >= 0 ? "$" + numberShort : numberShort.replace("-", "-$");
}

const symbols = ["", "k", "m", "b", "t", "q", "Q", "s", "S", "o", "n", "e33", "e36", "e39"];

/**
* Return a formatted representation of the monetary amount using scale sympols (e.g. 6.50M) 
* @param {number} num - The number to format
* @param {number=} maxSignificantFigures - (default: 6) The maximum significant figures you wish to see (e.g. 123, 12.3 and 1.23 all have 3 significant figures)
* @param {number=} maxDecimalPlaces - (default: 3) The maximum decimal places you wish to see, regardless of significant figures. (e.g. 12.3, 1.2, 0.1 all have 1 decimal)
**/
export function formatNumberShort(num: number, maxSignificantFigures = 6, maxDecimalPlaces = 3): string {
  if (Math.abs(num) > 10 ** (3 * symbols.length)) // If we've exceeded our max symbol, switch to exponential notation
      return num.toExponential(Math.min(maxDecimalPlaces, maxSignificantFigures - 1));
  let sign = 1;
  let i = 0;
  while ( num >= 1000 && i < symbols.length){
    num /= 1000;
    sign = Math.sign(num);
    num = Math.abs(num);
    i += 1;
  }
  // TODO: A number like 9.999 once rounted to show 3 sig figs, will become 10.00, which is now 4 sig figs.
  return ((sign < 0) ? "-" : "") + num.toFixed(Math.max(0, Math.min(maxDecimalPlaces, maxSignificantFigures - Math.floor(1 + Math.log10(num))))) + symbols[i];
}

/** Convert a shortened number back into a value */
export function parseShortNumber(text = "0"): number {
  const parsed = Number(text);
  if (!isNaN(parsed)) return parsed;
  for (const sym of symbols.slice(1))
      if (text.toLowerCase().endsWith(sym))
          return Number.parseFloat(text.slice(0, text.length - sym.length)) * Math.pow(10, 3 * symbols.indexOf(sym));
  return Number.NaN;
}

/**
* Return a number formatted with the specified number of significatnt figures or decimal places, whichever is more limiting.
* @param {number} num - The number to format
* @param {number=} minSignificantFigures - (default: 6) The minimum significant figures you wish to see (e.g. 123, 12.3 and 1.23 all have 3 significant figures)
* @param {number=} minDecimalPlaces - (default: 3) The minimum decimal places you wish to see, regardless of significant figures. (e.g. 12.3, 1.2, 0.1 all have 1 decimal)
**/
export function formatNumber(num: number, minSignificantFigures = 3, minDecimalPlaces = 1): number | string {
  return num == 0.0 ? num : num.toFixed(Math.max(minDecimalPlaces, Math.max(0, minSignificantFigures - Math.ceil(Math.log10(num)))));
}

/** Formats some RAM amount as a round number of GB with thousands separators e.g. `1,028 GB` */
export function formatRam(num: number): string { return `${Math.round(num).toLocaleString()} GB`; }

/** Return a datatime in ISO format */
export function formatDateTime(datetime: Date): string { return datetime.toISOString(); }

/** Format a duration (in milliseconds) as e.g. '1h 21m 6s' for big durations or e.g '12.5s' / '23ms' for small durations */
export function formatDuration(duration: number): string {
  if (duration < 1000) return `${duration.toFixed(0)}ms`
  if (!isFinite(duration)) return 'forever (Infinity)'
  const portions = [];
  const msInHour = 1000 * 60 * 60;
  const hours = Math.trunc(duration / msInHour);
  if (hours > 0) {
      portions.push(hours + 'h');
      duration -= (hours * msInHour);
  }
  const msInMinute = 1000 * 60;
  const minutes = Math.trunc(duration / msInMinute);
  if (minutes > 0) {
      portions.push(minutes + 'm');
      duration -= (minutes * msInMinute);
  }
  const seconds = (duration / 1000.0)
  // Include millisecond precision if we're on the order of seconds
  const secondsStr = (hours == 0 && minutes == 0) ? seconds.toPrecision(3) : seconds.toFixed(0);
  if (seconds > 0) {
      portions.push(secondsStr + 's');
      duration -= (minutes * 1000);
  }
  return portions.join(' ');
}

/** Generate a hashCode for a string that is pretty unique most of the time */
export function hashCode(s: string): number { return s.split("").reduce(function (a, b) { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0); }

/** @param {NS} ns **/
export function disableLogs(ns: NS, listOfLogs: string[]): void { ['disableLog'].concat(...listOfLogs).forEach(log => checkNsInstance(ns, '"disableLogs"').disableLog(log)); }

/** Joins all arguments as components in a path, e.g. pathJoin("foo", "bar", "/baz") = "foo/bar/baz" **/
export function pathJoin(...args: string[]): string {
  return args.filter(s => !!s).join('/').replace(/\/\/+/g, '/');
}

/** Gets the path for the given local file, taking into account optional subfolder relocation via git-pull.js **/
export function getFilePath(file: string): string {
  const subfolder = '';  // git-pull.js optionally modifies this when downloading
  return pathJoin(subfolder, file);
}

// FUNCTIONS THAT PROVIDE ALTERNATIVE IMPLEMENTATIONS TO EXPENSIVE NS FUNCTIONS
// VARIATIONS ON NS.RUN

/** @param {NS} ns
*  Use where a function is required to run a script and you have already referenced ns.run in your script **/
export function getFnRunViaNsRun(ns: NS): any { return checkNsInstance(ns, '"getFnRunViaNsRun"').run; }

/** @param {NS} ns
*  Use where a function is required to run a script and you have already referenced ns.exec in your script **/
export function getFnRunViaNsExec(ns: NS, host = "home"): any {
  checkNsInstance(ns, '"getFnRunViaNsExec"');
  return function (scriptPath: string, ...args: any) { return ns.exec(scriptPath, host, ...args); }
}
// VARIATIONS ON NS.ISRUNNING

/** @param {NS} ns
*  Use where a function is required to run a script and you have already referenced ns.run in your script  */
export function getFnIsAliveViaNsIsRunning(ns: NS): any { return checkNsInstance(ns, '"getFnIsAliveViaNsIsRunning"').isRunning; }

/** @param {NS} ns
*  Use where a function is required to run a script and you have already referenced ns.ps in your script  */
export function getFnIsAliveViaNsPs(ns: NS): any {
  checkNsInstance(ns, '"getFnIsAliveViaNsPs"');
  return function (pid: number, host: string) { return ns.ps(host).some(process => process.pid === pid); }
}

/**
* Retrieve the result of an ns command by executing it in a temporary .js script, writing the result to a file, then shuting it down
* Importing incurs a maximum of 1.1 GB RAM (0 GB for ns.read, 1 GB for ns.run, 0.1 GB for ns.isRunning).
* Has the capacity to retry if there is a failure (e.g. due to lack of RAM available). Not recommended for performance-critical code.
* @param {NS} ns - The nestcript instance passed to your script's main entry point
* @param {string} command - The ns command that should be invoked to get the desired data (e.g. "ns.getServer('home')" )
* @param {string=} fName - (default "/Temp/{commandhash}-data.txt") The name of the file to which data will be written to disk by a temporary process
* @param {args=} args - args to be passed in as arguments to command being run as a new script.
* @param {bool=} verbose - (default false) If set to true, pid and result of command are logged.
**/
export async function getNsDataThroughFile(ns: NS, command: string, fName: string, args: any[] = [], verbose = false, maxRetries = 5, retryDelayMs = 50) {
  checkNsInstance(ns, '"getNsDataThroughFile"');
  if (!verbose) disableLogs(ns, ['run', 'isRunning']);
  return await getNsDataThroughFile_Custom(ns, ns.run, ns.isRunning, command, fName, args, verbose, maxRetries, retryDelayMs);
}

/**
* An advanced version of getNsDataThroughFile that lets you pass your own "fnRun" and "fnIsAlive" implementations to reduce RAM requirements
* Importing incurs no RAM (now that ns.read is free) plus whatever fnRun / fnIsAlive you provide it
* Has the capacity to retry if there is a failure (e.g. due to lack of RAM available). Not recommended for performance-critical code.
* @param {NS} ns - The nestcript instance passed to your script's main entry point
* @param {function} fnRun - A single-argument function used to start the new sript, e.g. `ns.run` or `(f,...args) => ns.exec(f, "home", ...args)`
* @param {function} fnIsAlive - A single-argument function used to start the new sript, e.g. `ns.isRunning` or `pid => ns.ps("home").some(process => process.pid === pid)`
* @param {args=} args - args to be passed in as arguments to command being run as a new script.
**/
export async function getNsDataThroughFile_Custom(ns: NS, fnRun: any, fnIsAlive: any, command: string, fName: string, args: any[] = [], verbose = false, maxRetries = 5, retryDelayMs = 50) {
  checkNsInstance(ns, '"getNsDataThroughFile_Custom"');
  if (!verbose) disableLogs(ns, ['read']);
  const commandHash = hashCode(command);
  fName = fName || `/Temp/${commandHash}-data.txt`;
  const fNameCommand = (fName || `/Temp/${commandHash}-command`) + '.js'
  // Defend against stale data by pre-writing the file with invalid data TODO: Remove if this condition is never encountered
  await ns.write(fName, "STALE", 'w');
  // Prepare a command that will write out a new file containing the results of the command
  // unless it already exists with the same contents (saves time/ram to check first)
  // If an error occurs, it will write an empty file to avoid old results being misread.
  const commandToFile = `let result="";try{result=JSON.stringify(
      ${command}
      );}catch{} const f="${fName}"; if(ns.read(f)!=result) await ns.write(f,result,'w')`;
  // Run the command with auto-retries if it fails
  const pid = await runCommand_Custom(ns, fnRun, commandToFile, fNameCommand, args, false, maxRetries, retryDelayMs);
  // Wait for the process to complete
  await waitForProcessToComplete_Custom(ns, fnIsAlive, pid, verbose);
  if (verbose) ns.print(`Process ${pid} is done. Reading the contents of ${fName}...`);
  // Read the file, with auto-retries if it fails
  let lastRead;
  const fileData = await autoRetry(ns, () => ns.read(fName), (f: string) => (lastRead = f) !== undefined && f !== "" && f !== "STALE",
      `ns.read('${fName}') returned no result ("${lastRead}") (command likely failed to run).` +
          `\n  Command: ${command}\n  Script: ${fNameCommand}` +
          `\nEnsure you have sufficient free RAM to run this temporary script.`,
      maxRetries, retryDelayMs, undefined, verbose);
  if (verbose) ns.print(`Read the following data for command ${command}:\n${fileData}`);
  return JSON.parse(fileData); // Deserialize it back into an object/array and return
}

/** Evaluate an arbitrary ns command by writing it to a new script and then running or executing it.
* @param {NS} ns - The nestcript instance passed to your script's main entry point
* @param {string} command - The ns command that should be invoked to get the desired data (e.g. "ns.getServer('home')" )
* @param {string=} fileName - (default "/Temp/{commandhash}-data.txt") The name of the file to which data will be written to disk by a temporary process
* @param {args=} args - args to be passed in as arguments to command being run as a new script.
* @param {bool=} verbose - (default false) If set to true, the evaluation result of the command is printed to the terminal
*/
export async function runCommand(ns: NS, command: string, fileName: string, args = [], verbose = false, maxRetries = 5, retryDelayMs = 50) {
  checkNsInstance(ns, '"runCommand"');
  if (!verbose) disableLogs(ns, ['run']);
  return await runCommand_Custom(ns, ns.run, command, fileName, args, verbose, maxRetries, retryDelayMs);
}

/**
* An advanced version of runCommand that lets you pass your own "isAlive" test to reduce RAM requirements (e.g. to avoid referencing ns.isRunning)
* Importing incurs 0 GB RAM (assuming fnRun, fnWrite are implemented using another ns function you already reference elsewhere like ns.exec)
* @param {NS} ns - The nestcript instance passed to your script's main entry point
* @param {function} fnRun - A single-argument function used to start the new sript, e.g. `ns.run` or `(f,...args) => ns.exec(f, "home", ...args)`
* @param {string} command - The ns command that should be invoked to get the desired data (e.g. "ns.getServer('home')" )
* @param {string=} fileName - (default "/Temp/{commandhash}-data.txt") The name of the file to which data will be written to disk by a temporary process
* @param {args=} args - args to be passed in as arguments to command being run as a new script.
**/
export async function runCommand_Custom(ns: NS, fnRun: any, command: string, fileName: string, args: any[] = [], verbose = false, maxRetries = 5, retryDelayMs = 50) {
  checkNsInstance(ns, '"runCommand_Custom"');
  if (!verbose) disableLogs(ns, ['asleep']);
  const script = `import { formatMoney, formatNumberShort, formatDuration, parseShortNumber, scanAllServers } fr` + `om '${getFilePath('helpers.js')}'\n` +
      `export async function main(ns) { try { ` +
      (verbose ? `let output = ${command}; ns.tprint(output)` : command) +
      `; } catch(err) { ns.tprint(String(err)); throw(err); } }`;
  fileName = fileName || `/Temp/${hashCode(command)}-command.js`;
  // To improve performance and save on garbage collection, we can skip writing this exact same script was previously written (common for repeatedly-queried data)
  if (ns.read(fileName) != script) await ns.write(fileName, script, "w");
  // Wait for the script to appear (game can be finicky on actually completing the write)
  await autoRetry(ns, () => ns.read(fileName), (contents: string) => contents == script,
      `Temporary script ${fileName} is not available, despite having written it. (Did a competing process delete or overwrite it?)`,
      maxRetries, retryDelayMs, undefined, verbose);
  // Run the script, now that we're sure it is in place
  return await autoRetry(ns, () => fnRun(fileName, 1 /* Always 1 thread */, ...args), (temp_pid: number) => temp_pid !== 0,
      `Run command returned no pid (command likely failed to run).` +
          `\n  Command: ${command}\n  Temp Script: ${fileName}` +
          `\nEnsure you have sufficient free RAM to run this temporary script.`,
      maxRetries, retryDelayMs, undefined, verbose);
}

/**
* Wait for a process id to complete running
* Importing incurs a maximum of 0.1 GB RAM (for ns.isRunning) 
* @param {NS} ns - The nestcript instance passed to your script's main entry point
* @param {int} pid - The process id to monitor
* @param {bool=} verbose - (default false) If set to true, pid and result of command are logged.
**/
export async function waitForProcessToComplete(ns: NS, pid: number, verbose: boolean) {
  checkNsInstance(ns, '"waitForProcessToComplete"');
  if (!verbose) disableLogs(ns, ['isRunning']);
  return await waitForProcessToComplete_Custom(ns, ns.isRunning, pid, verbose);
}
/**
* An advanced version of waitForProcessToComplete that lets you pass your own "isAlive" test to reduce RAM requirements (e.g. to avoid referencing ns.isRunning)
* Importing incurs 0 GB RAM (assuming fnIsAlive is implemented using another ns function you already reference elsewhere like ns.ps) 
* @param {NS} ns - The nestcript instance passed to your script's main entry point
* @param {function} fnIsAlive - A single-argument function used to start the new sript, e.g. `ns.isRunning` or `pid => ns.ps("home").some(process => process.pid === pid)`
**/
export async function waitForProcessToComplete_Custom(ns: NS, fnIsAlive: any, pid: number, verbose: boolean) {
  checkNsInstance(ns, '"waitForProcessToComplete_Custom"');
  if (!verbose) disableLogs(ns, ['asleep']);
  // Wait for the PID to stop running (cheaper than e.g. deleting (rm) a possibly pre-existing file and waiting for it to be recreated)
  for (let retries = 0; retries < 1000; retries++) {
      if (!fnIsAlive(pid)) break; // Script is done running
      if (verbose && retries % 100 === 0) ns.print(`Waiting for pid ${pid} to complete... (${retries})`);
      await ns.asleep(10);
  }
  // Make sure that the process has shut down and we haven't just stopped retrying
  if (fnIsAlive(pid)) {
      const errorMessage = `run-command pid ${pid} is running much longer than expected. Max retries exceeded.`;
      ns.print(errorMessage);
      throw errorMessage;
  }
}

/** Helper to retry something that failed temporarily (can happen when e.g. we temporarily don't have enough RAM to run)
* @param {NS} ns - The nestcript instance passed to your script's main entry point */
export async function autoRetry(ns: NS, fnFunctionThatMayFail: any, fnSuccessCondition: any, errorContext = "Success condition not met",
  maxRetries = 5, initialRetryDelayMs = 50, backoffRate = 3, verbose = false) {
  checkNsInstance(ns, '"autoRetry"');
  let retryDelayMs = initialRetryDelayMs;
  while (maxRetries-- > 0) {
      try {
          const result = await fnFunctionThatMayFail()
          if (!fnSuccessCondition(result)) throw errorContext;
          return result;
      }
      catch (error) {
          const fatal = maxRetries === 0;
          const errorLog = `${fatal ? 'FAIL' : 'WARN'}: (${maxRetries} retries remaining): ${String(error)}`
          log(ns, errorLog, fatal, !verbose ? undefined : (fatal ? 'error' : 'warning'))
          if (fatal) throw error;
          await ns.asleep(retryDelayMs);
          retryDelayMs *= backoffRate;
      }
  }
}

/** Helper to log a message, and optionally also tprint it and toast it
* @param {NS} ns - The nestcript instance passed to your script's main entry point */
export function log(ns: NS, message = "", alsoPrintToTerminal = false, toastStyle = "", maxToastLength = Number.MAX_SAFE_INTEGER) {
  checkNsInstance(ns, '"log"');
  ns.print(message);
  if (alsoPrintToTerminal) ns.tprint(message);
  if (toastStyle) ns.toast(message.length <= maxToastLength ? message : message.substring(0, maxToastLength - 3) + "...", toastStyle);
  return message;
}

/** Helper to get a list of all hostnames on the network
* @param {NS} ns - The nestcript instance passed to your script's main entry point */
export function scanAllServers(ns: NS) {
  checkNsInstance(ns, '"scanAllServers"');
  const discoveredHosts: string[] = []; // Hosts (a.k.a. servers) we have scanned
  const hostsToScan = ["home"]; // Hosts we know about, but have no yet scanned
  let infiniteLoopProtection = 9999; // In case you mess with this code, this should save you from getting stuck
  while (hostsToScan.length > 0 && infiniteLoopProtection-- > 0) { // Loop until the list of hosts to scan is empty
      const hostName = hostsToScan.pop() as string; // Get the next host to be scanned
      for (const connectedHost of ns.scan(hostName)) // "scan" (list all hosts connected to this one)
          if (!discoveredHosts.includes(connectedHost)) // If we haven't already scanned this host
              hostsToScan.push(connectedHost); // Add it to the queue of hosts to be scanned
      discoveredHosts.push(hostName); // Mark this host as "scanned"
  }
  return discoveredHosts; // The list of scanned hosts should now be the set of all hosts in the game!
}

/** @param {NS} ns 
* Get a dictionary of active source files, taking into account the current active bitnode as well. **/
export async function getActiveSourceFiles(ns: NS, includeLevelsFromCurrentBitnode = true) {
  return await getActiveSourceFiles_Custom(ns, getNsDataThroughFile, includeLevelsFromCurrentBitnode);
}

/** @param {NS} ns 
* getActiveSourceFiles Helper that allows the user to pass in their chosen implementation of getNsDataThroughFile to minimize RAM usage **/
export async function getActiveSourceFiles_Custom(ns: NS, fnGetNsDataThroughFile: any, includeLevelsFromCurrentBitnode = true) {
  checkNsInstance(ns, '"getActiveSourceFiles"');
  const tempFile = '/Temp/owned-source-files.txt';
  // Find out what source files the user has unlocked
  let dictSourceFiles;
  // eslint-disable-next-line no-empty
  try { await fnGetNsDataThroughFile(ns, `Object.fromEntries(ns.getOwnedSourceFiles().map(sf => [sf.n, sf.lvl]))`, tempFile); } catch { }
  if (!dictSourceFiles) { // Bit of a hack, but if RAM is so low that this fails, we can fallback to using an older version of this file, and even assuming we have no source files.
      dictSourceFiles = ns.read(tempFile)
      dictSourceFiles = dictSourceFiles ? JSON.parse(dictSourceFiles) : {};
  }
  // If the user is currently in a given bitnode, they will have its features unlocked
  if (includeLevelsFromCurrentBitnode) {
      const bitNodeN = (await fnGetNsDataThroughFile(ns, 'ns.getPlayer()', '/Temp/player-info.txt')).bitNodeN;
      dictSourceFiles[bitNodeN] = Math.max(3, dictSourceFiles[bitNodeN] || 0);
  }
  return dictSourceFiles;
}

/** @param {NS} ns 
* Return bitnode multiplers, or null if they cannot be accessed. **/
export async function tryGetBitNodeMultipliers(ns: NS) {
  return await tryGetBitNodeMultipliers_Custom(ns, getNsDataThroughFile);
}

/** @param {NS} ns
* tryGetBitNodeMultipliers Helper that allows the user to pass in their chosen implementation of getNsDataThroughFile to minimize RAM usage **/
export async function tryGetBitNodeMultipliers_Custom(ns: NS, fnGetNsDataThroughFile: any) {
  checkNsInstance(ns, '"tryGetBitNodeMultipliers"');
  let canGetBitNodeMultipliers = false;
  // eslint-disable-next-line no-empty
  try { canGetBitNodeMultipliers = 5 in (await getActiveSourceFiles_Custom(ns, fnGetNsDataThroughFile)); } catch { }
  if (!canGetBitNodeMultipliers) return null;
  // eslint-disable-next-line no-empty
  try { return await fnGetNsDataThroughFile(ns, 'ns.getBitNodeMultipliers()', '/Temp/bitnode-multipliers.txt'); } catch { }
  return null;
}

/** @param {NS} ns 
* Returns the number of instances of the current script running on the specified host. **/
export async function instanceCount(ns: NS, onHost = "home", warn = true, tailOtherInstances = true) {
  checkNsInstance(ns, '"alreadyRunning"');
  const scriptName = ns.getScriptName();
  const others = await getNsDataThroughFile(ns, 'ns.ps(ns.args[0]).filter(p => p.filename == ns.args[1]).map(p => p.pid)',
      '/Temp/ps-other-instances.txt', [onHost, scriptName]);
  if (others.length >= 2) {
      if (warn)
          log(ns, `WARNING: You cannot start multiple versions of this script (${scriptName}). Please shut down the other instance first.` +
              (tailOtherInstances ? ' (To help with this, a tail window for the other instance will be opened)' : ''), true, 'warning');
      if (tailOtherInstances) // Tail all but the last pid, since it will belong to the current instance (which will be shut down)
          others.slice(0, others.length - 1).forEach((pid: number) => ns.tail(pid));
  }
  return others.length;
}

/** @param {NS} ns 
* Returns a helpful error message if we forgot to pass the ns instance to a function */
export function checkNsInstance(ns: NS, fnName = "this function") { if (!ns.print) throw `The first argument to ${fnName} should be a 'ns' instance.`; return ns; }