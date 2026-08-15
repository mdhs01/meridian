/**
 * Phase 3A.1 runtime adapter.
 *
 * Keeps infrastructure concerns (scheduler) separate from Meridian's
 * existing cycle implementations. The adapter owns only callback wiring;
 * it does not move or rewrite trading logic.
 */

export function createRuntimeAdapter({
  runManagement,
  runScreening,
  runHealth,
  runBriefing,
  runBriefingWatchdog,
  runPnlPoll,
}) {
  if (typeof runManagement !== "function") {
    throw new TypeError("runManagement is required");
  }
  if (typeof runScreening !== "function") {
    throw new TypeError("runScreening is required");
  }

  return Object.freeze({
    onManagement: ({ source = "scheduler" } = {}) => runManagement({ source }),
    onScreening: ({ source = "scheduler" } = {}) => runScreening({ source }),
    onHealth: runHealth ? () => runHealth() : undefined,
    onBriefing: runBriefing ? () => runBriefing() : undefined,
    onBriefingWatchdog: runBriefingWatchdog ? () => runBriefingWatchdog() : undefined,
    onPnlPoll: runPnlPoll ? () => runPnlPoll() : undefined,
  });
}
