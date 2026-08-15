import assert from "node:assert/strict";
import {
  DATA_STATUS,
  DECISION_ACTION,
  RISK_STATE,
  DECISION_SOURCE,
  candidate,
  dataPoint,
  executionResult,
  assertCandidate,
  assertExecutionResult,
  validateEnum,
} from "../domain/contracts.js";

function main() {
  const c = candidate({
    token: { mint: "TokenMint111" },
    pool: { address: "Pool111" },
    dataQuality: {
      security: dataPoint({ source: "gmgn" }),
    },
  });

  assert.equal(c.id, "Pool111");
  assert.doesNotThrow(() => assertCandidate(c));
  assert.throws(() => assertCandidate(candidate({ token: { mint: "x" } })), /pool.address/);

  const result = executionResult({ action: DECISION_ACTION.CLOSE, success: true, dryRun: true });
  assert.doesNotThrow(() => assertExecutionResult(result));
  assert.throws(() => assertExecutionResult({ success: "yes" }), /success must be boolean/);

  validateEnum(DATA_STATUS.STALE, DATA_STATUS, "status");
  validateEnum(RISK_STATE.EMERGENCY, RISK_STATE, "state");
  validateEnum(DECISION_SOURCE.RULE, DECISION_SOURCE, "source");

  console.log("=== Domain contract tests passed ===");
}

main();
