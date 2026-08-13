/**
 * Consistent logging for journalctl: OldGrowthPriceTracker: …
 */

let _debug = false;

export function setDebugLogging(on) {
  _debug = !!on;
}

export function isDebugLogging() {
  return _debug;
}

export function logInfo(...args) {
  console.log('OldGrowthPriceTracker:', ...args);
}

export function logWarn(...args) {
  console.warn('OldGrowthPriceTracker:', ...args);
}

export function logError(...args) {
  console.error('OldGrowthPriceTracker:', ...args);
}

/** Verbose path — only when debug-logging setting is on */
export function logDebug(...args) {
  if (_debug) console.log('OldGrowthPriceTracker[debug]:', ...args);
}
