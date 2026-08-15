/**
 * Meridian scheduler service.
 *
 * Phase 3 introduces scheduling as an isolated infrastructure concern.
 * It intentionally knows nothing about screening, management, LLMs, or
 * execution. Callers provide the work functions and lifecycle callbacks.
 */

import cron from "node-cron";

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
}) {
  if (typeof onManagement !== "function") throw new TypeError("onManagement is required");
  if (typeof onScreening !== "function") throw new TypeError("onScreening is required");

  let tasks = [];
  let pnlTimer = null;
  let started = false;
  let managementBusy = false;
  let screeningBusy = false;
  let pnlPollBusy = false;

  const managementMin = safeInterval(managementIntervalMin);
  const screeningMin = safeInterval(screeningIntervalMin);
  const healthMin = safeInterval(healthCheckIntervalMin, 60);

  async function guardedManagement(source = "cron") {
    if (managementBusy) return null;
    managementBusy = true;
    try {
      return await onManagement({ source });
    } finally {
      managementBusy = false;
    }
  }

  async function guardedScreening(source = "cron") {
    if (screeningBusy) return null;
    screeningBusy = true;
    try {
      return await onScreening({ source });
    } finally {
      screeningBusy = false;
    }
  }

  async function guardedHealth() {
    if (managementBusy) return null;
    managementBusy = true;
    try {
      return await onHealth?.();
    } finally {
      managementBusy = false;
    }
  }

  async function guardedPnlPoll() {
    if (managementBusy || screeningBusy || pnlPollBusy || !onPnlPoll) return null;
    pnlPollBusy = true;
    try {
      return await onPnlPoll();
    } finally {
      pnlPollBusy = false;
    }
  }

  function stop() {
    for (const task of tasks) task.stop();
    tasks = [];
    if (pnlTimer) clearInterval(pnlTimer);
    pnlTimer = null;
    started = false;
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

    started = true;
    onScheduleStart?.({ managementMin, screeningMin, healthMin });
    logger("cron", `Scheduler started — management every ${managementMin}m, screening every ${screeningMin}m`);
  }

  return {
    start,
    stop,
    isStarted: () => started,
    isManagementBusy: () => managementBusy,
    isScreeningBusy: () => screeningBusy,
    getIntervals: () => ({ managementMin, screeningMin, healthMin }),
  };
}
