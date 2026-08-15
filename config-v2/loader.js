import crypto from "node:crypto";
import { CONFIG_SCHEMA_VERSION, DEFAULT_CONFIG, TUNABLE_PATHS, HARD_SAFETY_PATHS } from "./defaults.js";

function clone(value) {
  return structuredClone(value);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function merge(base, override) {
  if (!isObject(base) || !isObject(override)) return override === undefined ? base : override;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = isObject(value) && isObject(out[key]) ? merge(out[key], value) : value;
  }
  return out;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function fingerprint(config) {
  const canonical = JSON.stringify(canonicalize(config));
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 12);
}

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const parts = path.split(".");
  const leaf = parts.pop();
  let cursor = object;
  for (const part of parts) {
    if (!isObject(cursor[part])) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[leaf] = value;
}

/**
 * Build a deterministic, versioned configuration snapshot.
 * Secrets and environment credentials are intentionally not part of this object.
 */
export function buildConfigSnapshot(overrides = {}) {
  const values = merge(clone(DEFAULT_CONFIG), overrides);
  const hash = fingerprint(values);
  const createdAt = new Date().toISOString();

  return Object.freeze({
    schemaVersion: CONFIG_SCHEMA_VERSION,
    configVersion: `cfg-${hash}`,
    createdAt,
    values: Object.freeze(values),
  });
}

/**
 * Apply a tuning patch to a config snapshot.
 * Only explicitly registered tunable paths are accepted.
 * Hard-safety paths can be changed manually, but are never accepted by autoTune=false.
 */
export function tuneConfig(snapshot, patch, { allowHardSafety = false } = {}) {
  if (!snapshot?.values) throw new Error("Invalid config snapshot");
  const next = clone(snapshot.values);

  for (const [path, value] of Object.entries(patch || {})) {
    if (!TUNABLE_PATHS.includes(path)) {
      throw new Error(`Unsupported tuning path: ${path}`);
    }
    if (!allowHardSafety && HARD_SAFETY_PATHS.includes(path)) {
      throw new Error(`Hard-safety parameter requires explicit approval: ${path}`);
    }
    setPath(next, path, value);
  }

  return buildConfigSnapshot(next);
}

export function getConfigValue(snapshot, path) {
  return getPath(snapshot?.values, path);
}

export function diffConfig(a, b) {
  if (!a?.values || !b?.values) throw new Error("Invalid config snapshot");
  const paths = new Set([...TUNABLE_PATHS]);
  const changes = [];
  for (const path of paths) {
    const before = getPath(a.values, path);
    const after = getPath(b.values, path);
    if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ path, before, after });
  }
  return changes;
}

export function getTuningRegistry() {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    tunablePaths: [...TUNABLE_PATHS],
    hardSafetyPaths: [...HARD_SAFETY_PATHS],
  };
}
