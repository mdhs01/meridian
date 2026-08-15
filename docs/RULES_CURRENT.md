# Meridian Current Trading Rules

This is a Phase 0 inventory of rules observed in the current code. It is a reference for regression testing; it is not a proposal to change these values.

## Screening rules

Current configuration includes thresholds for:

- minimum fee/active-TVL ratio
- minimum/maximum TVL
- minimum volume
- minimum organic score
- minimum holders
- minimum/maximum market cap
- minimum/maximum DLMM bin step
- timeframe/category
- minimum token fees in SOL
- maximum bundle percentage
- maximum bot-holder percentage
- maximum top-10 concentration
- blocked launchpads
- token age limits
- ATH distance filter

The screening implementation additionally applies blacklist and developer blocklist checks, occupied-position exclusions, wash-trading filtering, and enriched risk/ATH/creator checks.

## Management rules

Current management logic includes, in priority order where applicable:

1. tracked hard exit state
2. instruction handoff to LLM
3. PnL sanity protection for suspicious extreme negative API values
4. stop loss
5. take profit
6. pumped-too-far above configured range
7. stale out-of-range timeout
8. low fee-yield close condition
9. claim threshold
10. otherwise stay

## Position sizing

Current dynamic deployment sizing is based on:

`clamp((walletSol - gasReserve) * positionSizePct, deployAmountSol, maxDeployAmount)`

The configured floor, reserve, percentage, and maximum are all tunable values.

## Strategy

Current configuration exposes a strategy name and bin placement settings. The repository also contains a strategy library used by management/screening orchestration.

## LLM safety behavior

The current agent loop contains protections against:

- action requests completing without real tool usage
- duplicate destructive tool calls within a session
- deployment retry after an initial attempt
- malformed tool-call JSON
- transient provider errors

These protections must remain intact during refactor and later become explicit safety/decision-layer responsibilities.

## Important Phase 0 constraint

No current threshold is being declared optimal. Phase 0 only records behavior so future tuning can be measured against it.
