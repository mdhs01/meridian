/**
 * Meridian scheduler service.
 *
 * Phase 3 introduces scheduling as an isolated infrastructure concern.
 * It intentionally knows nothing about screening, management, LLMs, or
 * execution. Callers provide the work functions and lifecycle callbacks.
 */

import cron from "node-cron";
import { createSchedulerState } from "./scheduler-state.js";

function safeInterval(value, fallback = 1) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.floor(n)) : fallback;
}

export function createScheduler({
  managementIntervalMin,
  screeningIntervalMin,
  healthCheckIntervalMin = 60,
  onManagement,
  onScreening,
  onHealth,
  onBriefing,
  onBriefingWatchdog,
  onPnlPoll,
  onScheduleStart,
  logger = () => {},
  state = createSchedulerState(),
}) {
  if (typeof onManagement !== "function") throw new TypeError("onManagement is required");
  if (typeof onScreening !== "function") throw new TypeError("onScreening is required");

  let tasks = [];
  let pnlTimer = null;

  const managementMin = safeInterval(managementIntervalMin);
  const screeningMin = safeInterval(screeningIntervalMin);
  const healthMin = safeInterval(healthCheckIntervalMin, 60);

  async function guardedManagement(source = "cron") {
    if (state.isManagementBusy()) return null;
    state.setManagementBusy(true);
    state.markManagementRun();
    try {
      return await onManagement({ source });
    } finally {
      state.setManagementBusy(false);
    }
  }

  async function guardedScreening(source = "cron") {
    if (state.isScreeningBusy()) return null;
    state.setScreeningBusy(true);
    state.markScreeningRun();
    try {
      return await onScreening({ source });
    } finally {
      state.setScreeningBusy(false);
    }
  }

  async function guardedHealth() {
    if (state.isManagementBusy()) return null;
    state.setManagementBusy(true);
    try {
      return await onHealth?.();
    } finally {
      state.setManagementBusy(false);
    }
  }

  async function guardedPnlPoll() {
    if (state.isManagementBusy() || state.isScreeningBusy() || state.isPnlPollBusy() || !onPnlPoll) return null;
    state.setPnlPollBusy(true);
    state.markPollTriggered();
    try {
      return await onPnlPoll();
    } finally {
      state.setPnlPollBusy(false);
    }
  }

  function stop() {
    for (const task of tasks) task.stop();
    tasks = [];
    if (pnlTimer) clearInterval(pnlTimer);
    pnlTimer = null;
    state.reset();
    logger("cron", "Scheduler stopped");
  }

  function start() {
    stop();

    tasks.push(
      cron.schedule(`*/${managementMin} * * * *`, () => guardedManagement("cron")),
      cron.schedule(`*/${screeningMin} * * * *`, () => guardedScreening("cron")),
    );

    if (onHealth) {
      tasks.push(cron.schedule(`0 * * * *`, () => guardedHealth()));
    }

    if (onBriefing) {
      tasks.push(cron.schedule("0 1 * * *", () => onBriefing(), { timezone: "UTC" }));
    }

    if (onBriefingWatchdog) {
      tasks.push(cron.schedule("0 */6 * * *", () => onBriefingWatchdog(), { timezone: "UTC" }));
    }

    if (onPnlPoll) {
      pnlTimer = setInterval(() => guardedPnlPoll(), 30_000);
    }

    state.setStarted(true);
    onScheduleStart?.({ managementMin, screeningMin, healthMin });
    logger("cron", `Scheduler started — management every ${managementMin}m, screening every ${screeningMin}m`);
  }

  return {
    start,
    stop,
    isStarted: () => state.isStarted(),
    isManagementBusy: () => state.isManagementBusy(),
    isScreeningBusy: () => state.isScreeningBusy(),
    getIntervals: () => ({ managementMin, screeningMin, healthMin }),
    getState: () => state,
  };
}
