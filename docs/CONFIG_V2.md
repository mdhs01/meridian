# Meridian V2 Configuration & Tuning Contract

Phase 2 introduces a versioned configuration model without changing the legacy runtime configuration.

## Goals

- Make strategy/filter parameters explicit and discoverable.
- Produce a deterministic `configVersion` for every configuration snapshot.
- Allow controlled tuning without editing business logic.
- Prevent automatic tuning from changing hard-safety parameters.
- Preserve enough metadata for future replay/backtest and trade-journal attribution.

## Configuration classes

### Tunable

Examples include screening thresholds, strategy parameters, and management thresholds such as fee/yield and range behavior.

### Hard safety

Examples include maximum positions, maximum deployment, SOL reserve, and gas reserve. These may be changed only through an explicit/manual path and are not eligible for automatic tuning.

## Versioning

A configuration snapshot contains:

```text
schemaVersion
configVersion
createdAt
values
```

`configVersion` is derived from a canonical SHA-256 fingerprint of the non-secret configuration values. The same values therefore produce the same configuration identity.

## Runtime safety

Phase 2 is additive. The existing `config.js` remains the runtime source for the current bot. The V2 configuration layer is not wired into trading execution yet. That migration will happen only after the contracts are validated and the core is refactored.

## Future flow

```text
Legacy / Profile Config
        ↓
V2 Config Snapshot
        ↓
Validation
        ↓
Version
        ↓
Runtime
        ↓
DecisionRecord
        ↓
Replay / Evaluation
        ↓
Tuning
```

This separation is intentional: configuration can evolve independently from the trading engines.
