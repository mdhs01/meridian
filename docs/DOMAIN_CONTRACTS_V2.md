# Meridian V2 — Domain Contracts

## Purpose

Phase 1 establishes stable domain objects before legacy modules are extracted. Existing runtime code is intentionally not migrated in this phase.

The contract boundary is:

```text
DATA ADAPTERS
    ↓
TokenProfile / PoolProfile / MarketProfile / SecurityProfile / IndicatorProfile
    ↓
Candidate
    ↓
ScoreProfile
    ↓
StrategyDecision + RiskDecision
    ↓
Position
    ↓
ExecutionRequest → ExecutionResult
    ↓
DecisionRecord / Evaluation
```

## Core objects

### TokenProfile
Identity and relatively stable token metadata.

Required:
- `mint`

Optional:
- symbol, name, decimals, createdAt, dev, launchpad

### PoolProfile
DLMM pool and liquidity context.

Required:
- `address`

Optional:
- tokenX/tokenY, binStep, activeBin, TVL, volume24h, fees24h, feeTvlRatio, liquidity

### MarketProfile
Short-lived market state.

Includes price, volume, volatility, ATH relationship, momentum and structure.

### SecurityProfile
Risk/security evidence from external providers. It is evidence, not a final decision.

Includes bundle, sniper, suspicious, concentration, insider, creator, bot-holder, wash-trading and rug-pull signals.

### IndicatorProfile
Quantitative indicators supplied by the private indicator server or other analytics adapters.

The `custom` object allows new indicators without changing the core contract.

### Candidate
The normalized screening unit. A candidate joins token, pool, market, security, indicators and data-quality information.

A candidate must contain:
- `id`
- `token.mint`
- `pool.address`

### ScoreProfile
Stores the score and its component contributions. The scoring version is mandatory once scoring is introduced.

### StrategyDecision
Answers: **how should capital be deployed?**

It must not contain raw provider-specific API structures.

### RiskDecision
Answers: **is the proposed action currently allowed from a risk perspective?**

Hard-stop decisions can override strategy/LLM recommendations.

### Position
Normalized live position state. Provider-specific SDK responses remain outside this object.

### ExecutionRequest / ExecutionResult
Execution is a separate boundary. The decision layer requests an action; the execution layer reports the result.

`dryRun` is explicit and defaults to `true` in the contract factory.

### DecisionRecord
Permanent audit/evaluation unit. It records:
- entity
- action
- source
- strategy/filter/score/config versions
- input snapshot
- rationale
- risk decision
- execution result

This object is the foundation for replay, regression testing and parameter tuning.

## Data quality

Every external or computed data source will eventually map to one of:

- `AVAILABLE`
- `STALE`
- `MISSING`
- `INVALID`
- `CONFLICT`

A missing or stale value is **not automatically safe**. Policy for each field belongs to the consuming layer.

## Provider isolation

No future core/domain module should depend directly on:

- GMGN response shapes
- Meteora API response shapes
- Jupiter response shapes
- RPC response shapes
- private indicator server response shapes

Adapters translate provider data into these contracts.

The target architecture therefore allows GMGN, Meteora, RPC or the private indicator server to change independently from screening/strategy/risk logic.

## Decision separation

These meanings must remain separate:

```text
Signal       = observed/computed evidence
Score        = normalized assessment of evidence
Strategy     = how to deploy/manage liquidity
Risk         = whether an action is permitted
Decision     = selected action
Execution    = actual blockchain operation
Result       = what happened
```

LLM reasoning may contribute to a decision, but it cannot bypass hard safety constraints.

## Versioning rule

Once Phase 2 introduces configuration versions, every material decision must be able to reference:

```text
strategyVersion
filterVersion
scoreVersion
configVersion
```

This is required to answer: "Which rules produced this trade?"
