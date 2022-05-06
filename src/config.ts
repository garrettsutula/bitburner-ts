export const calculationParameters = {
  // Target % of money to hack from the server each procedure.
  hackPercentage: 0.15,
  // % of money where we switch from 'prepare' to 'hack'
  maxServeryMoneyPercentage: 0.95,
  // % over minimum security allowed
  maxSecurityThreshold: 1.3,
  prepareGrowthFactor: 1.15,
  // Execution buffer between steps
  stepBuffer: 50,
}

export const schedulerParameters = {
  // Timer for ns.sleep in main loop.
  tickRate: 200, 
  // Number of targets to start hacking when the script starts running.
  // When a server is done being prepared, we increase this by one to move on to the next host.
  baseAttackLimit: 1,
  // Buffer ensure procedure execution doesn't overlap.
  executionBufferMs: 250,
  // When set to false, immediately target all hosts we can
  respectAttackLimit: false,
  reserveHomeRamGb: 0,
}

export const scriptPaths = {
  hackOnce: '/scripts/hackOnce.js',
  growOnce: '/scripts/growOnce.js',
  weakenOnce: '/scripts/weakenOnce.js',
  basicHack: '/scripts/basic-hack.js',
};
