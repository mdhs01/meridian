import assert from "node:assert/strict";
import {
  buildConfigSnapshot,
  diffConfig,
  getConfigValue,
  getTuningRegistry,
  tuneConfig,
} from "../config-v2/loader.js";

const base = buildConfigSnapshot();
assert.equal(base.schemaVersion, "2.0.0");
assert.match(base.configVersion, /^cfg-[a-f0-9]{12}$/);
assert.equal(getConfigValue(base, "screening.minTokenFeesSol"), 30);

const tuned = tuneConfig(base, {
  "screening.minTokenFeesSol": 40,
  "screening.minOrganic": 70,
  "strategy.binsBelow": 75,
});

assert.notEqual(tuned.configVersion, base.configVersion);
assert.deepEqual(diffConfig(base, tuned), [
  { path: "screening.minTokenFeesSol", before: 30, after: 40 },
  { path: "screening.minOrganic", before: 60, after: 70 },
  { path: "strategy.binsBelow", before: 69, after: 75 },
]);

assert.throws(
  () => tuneConfig(base, { "management.gasReserve": 0.3 }),
  /Hard-safety parameter requires explicit approval/
);

assert.throws(
  () => tuneConfig(base, { "does.not.exist": 1 }),
  /Unsupported tuning path/
);

const registry = getTuningRegistry();
assert.ok(registry.tunablePaths.includes("screening.minTokenFeesSol"));
assert.ok(registry.hardSafetyPaths.includes("management.gasReserve"));

console.log("Config V2 tests passed.");
