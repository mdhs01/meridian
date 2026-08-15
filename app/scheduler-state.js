/**
 * Scheduler-owned runtime state.
 *
 * Phase 3A.2 extracts scheduling state from index.js. The state is private to
 * one scheduler instance and is deliberately free of trading/business data.
 */

export function createSchedulerState() {
  let started = false;
  let managementBusy = false;
  let screeningBusy = false;
  let pnlPollBusy = false;
  let managementLastRun = null;
  let screeningLastRun = null;
  let screeningLastTriggered = 0;
  let pollTriggeredAt = 0;

  return {
    isStarted: () => started,
    setStarted: (value) => { started = Boolean(value); },

    isManagementBusy: () => managementBusy,
    setManagementBusy: (value) => { managementBusy = Boolean(value); },

    isScreeningBusy: () => screeningBusy,
    setScreeningBusy: (value) => { screeningBusy = Boolean(value); },

    isPnlPollBusy: () => pnlPollBusy,
    setPnlPollBusy: (value) => { pnlPollBusy = Boolean(value); },

    getManagementLastRun: () => managementLastRun,
    markManagementRun: (at = Date.now()) => { managementLastRun = at; },

    getScreeningLastRun: () => screeningLastRun,
    markScreeningRun: (at = Date.now()) => { screeningLastRun = at; },

    getScreeningLastTriggered: () => screeningLastTriggered,
    markScreeningTriggered: (at = Date.now()) => { screeningLastTriggered = at; },

    getPollTriggeredAt: () => pollTriggeredAt,
    markPollTriggered: (at = Date.now()) => { pollTriggeredAt = at; },

    reset() {
      started = false;
      managementBusy = false;
      screeningBusy = false;
      pnlPollBusy = false;
      managementLastRun = null;
      screeningLastRun = null;
      screeningLastTriggered = 0;
      pollTriggeredAt = 0;
    },
  };
}
