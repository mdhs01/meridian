import assert from "node:assert/strict";
import { createScheduler } from "../app/scheduler.js";
import { createLifecycle } from "../app/lifecycle.js";

const calls = [];
const scheduler = createScheduler({
  managementIntervalMin: 10,
  screeningIntervalMin: 30,
  healthCheckIntervalMin: 60,
  onManagement: async ({ source }) => calls.push(`management:${source}`),
  onScreening: async ({ source }) => calls.push(`screening:${source}`),
  onHealth: async () => calls.push("health"),
  onBriefing: async () => calls.push("briefing"),
  onBriefingWatchdog: async () => calls.push("briefing-watchdog"),
  onPnlPoll: async () => calls.push("pnl"),
});

assert.deepEqual(scheduler.getIntervals(), {
  managementMin: 10,
  screeningMin: 30,
  healthMin: 60,
});
assert.equal(scheduler.isStarted(), false);
assert.equal(scheduler.isManagementBusy(), false);
assert.equal(scheduler.isScreeningBusy(), false);

scheduler.start();
assert.equal(scheduler.isStarted(), true);
scheduler.stop();
assert.equal(scheduler.isStarted(), false);

let exited = null;
let stoppedPolling = false;
const lifecycle = createLifecycle({
  scheduler,
  stopPolling: () => { stoppedPolling = true; },
  getOpenPositions: async () => ({ total_positions: 2 }),
  logger: () => {},
  exit: (code) => { exited = code; },
});

await lifecycle.shutdown("TEST");
assert.equal(stoppedPolling, true);
assert.equal(exited, 0);
assert.equal(lifecycle.isShuttingDown(), true);

console.log("✓ Scheduler and lifecycle tests passed");
