export const calculationParameters = {
  // Global throttling ratio, useful early game.
  throttleRatio: 0.15,
  // Target % of money to hack from the server each procedure.
  hackPercentage: 0.20,
  prepareGrowPercentage: 1.20,
  // Execution buffer between steps
  stepBuffer: 15,
}

export const schedulerParameters = {
  // Timer for ns.sleep in main loop.
  tickRate: 20, 
  // Number of times we run queueAndExecuteProcedures before going back to sleep.
  // If we run out of ram, we break out of this loop early.
  queueAndExecutesPerTick: 50,
  // Number of targets to start hacking when the script starts running.
  // When a server is done being prepared, we increase this by one to move on to the next host.
  baseAttackLimit: 1,
  // Buffer ensure procedure execution doesn't overlap.
  executionBufferMs: 500,
  // When set to false, immediately target all hosts we can
  respectAttackLimit: false,
}

export const scriptPaths = {
  hackOnce: '/scripts/hackOnce.js',
  growOnce: '/scripts/growOnce.js',
  weakenOnce: '/scripts/weakenOnce.js',
};