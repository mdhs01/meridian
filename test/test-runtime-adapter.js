import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimeAdapter } from "../app/runtime.js";

test("runtime adapter wires management and screening callbacks", async () => {
  const calls = [];
  const runtime = createRuntimeAdapter({
    runManagement: async ({ source }) => calls.push(["management", source]),
    runScreening: async ({ source }) => calls.push(["screening", source]),
  });

  await runtime.onManagement({ source: "test" });
  await runtime.onScreening({ source: "test" });

  assert.deepEqual(calls, [
    ["management", "test"],
    ["screening", "test"],
  ]);
});

test("runtime adapter exposes optional callbacks without inventing implementations", async () => {
  let healthCalls = 0;
  let pnlCalls = 0;

  const runtime = createRuntimeAdapter({
    runManagement: async () => {},
    runScreening: async () => {},
    runHealth: async () => { healthCalls += 1; },
    runPnlPoll: async () => { pnlCalls += 1; },
  });

  await runtime.onHealth();
  await runtime.onPnlPoll();

  assert.equal(healthCalls, 1);
  assert.equal(pnlCalls, 1);
  assert.equal(runtime.onBriefing, undefined);
  assert.equal(runtime.onBriefingWatchdog, undefined);
});

test("runtime adapter requires the two core cycles", () => {
  assert.throws(() => createRuntimeAdapter({}), /runManagement is required/);
  assert.throws(() => createRuntimeAdapter({ runManagement() {} }), /runScreening is required/);
});
