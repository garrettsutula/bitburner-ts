export const calculationParameters = {
  // Target % of money to hack from the server each procedure.
  hackPercentage: 0.90,
  // % of money to grow each round of prepare
  prepareGrowthFactor: 1.50,
  // % of money where we switch from 'prepare' to 'hack'
  maxServeryMoneyPercentage: 0.95,
  // % over minimum security allowed
  maxSecurityThreshold: 1.20,
  // Execution buffer between steps
  stepBuffer: 15,
}

export const schedulerParameters = {
  // Timer for ns.sleep in main loop.
  tickRate: 25, 
  // Number of times we run queueAndExecuteProcedures before going back to sleep.
  // If we run out of ram, we break out of this loop early.
  queueAndExecutesPerTick: 50,
  // Number of targets to start hacking when the script starts running.
  // When a server is done being prepared, we increase this by one to move on to the next host.
  baseAttackLimit: 1,
  // Buffer ensure procedure execution doesn't overlap.
  executionBufferMs: 100,
  // When set to false, immediately target all hosts we can
  respectAttackLimit: false,
  reserveHomeRamGb: 64,
}

export const scriptPaths = {
  hackOnce: '/scripts/hackOnce.js',
  growOnce: '/scripts/growOnce.js',
  weakenOnce: '/scripts/weakenOnce.js',
  basicHack: '/scripts/basic-hack.js',
};