import assert from "node:assert/strict";
import test from "node:test";
import { createSchedulerState } from "../app/scheduler-state.js";

test("scheduler state starts clean", () => {
  const state = createSchedulerState();

  assert.equal(state.isStarted(), false);
  assert.equal(state.isManagementBusy(), false);
  assert.equal(state.isScreeningBusy(), false);
  assert.equal(state.isPnlPollBusy(), false);
  assert.equal(state.getManagementLastRun(), null);
  assert.equal(state.getScreeningLastRun(), null);
  assert.equal(state.getScreeningLastTriggered(), 0);
  assert.equal(state.getPollTriggeredAt(), 0);
});

test("scheduler state tracks independent runtime markers", () => {
  const state = createSchedulerState();

  state.setStarted(true);
  state.setManagementBusy(true);
  state.setScreeningBusy(true);
  state.setPnlPollBusy(true);
  state.markManagementRun(1000);
  state.markScreeningRun(2000);
  state.markScreeningTriggered(3000);
  state.markPollTriggered(4000);

  assert.equal(state.isStarted(), true);
  assert.equal(state.isManagementBusy(), true);
  assert.equal(state.isScreeningBusy(), true);
  assert.equal(state.isPnlPollBusy(), true);
  assert.equal(state.getManagementLastRun(), 1000);
  assert.equal(state.getScreeningLastRun(), 2000);
  assert.equal(state.getScreeningLastTriggered(), 3000);
  assert.equal(state.getPollTriggeredAt(), 4000);
});

test("scheduler state reset clears only scheduler state", () => {
  const state = createSchedulerState();
  state.setStarted(true);
  state.setManagementBusy(true);
  state.markManagementRun(1234);
  state.markScreeningTriggered(5678);

  state.reset();

  assert.equal(state.isStarted(), false);
  assert.equal(state.isManagementBusy(), false);
  assert.equal(state.getManagementLastRun(), null);
  assert.equal(state.getScreeningLastTriggered(), 0);
});
