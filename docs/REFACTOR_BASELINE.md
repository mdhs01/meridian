# Meridian Refactor Baseline

Date: 2026-08-15
Branch: `refactor/phase-0-baseline`
Base: `main`

## Purpose

This document freezes the current architecture and behavior before the Meridian refactor. Phase 0 must not change trading behavior.

## Repository baseline

- Repository: `mdhs01/meridian`
- Default branch: `main`
- Runtime: Node.js >= 18, ESM
- Entry point: `index.js`
- CLI entry point: `cli.js`
- Current package version: `1.0.0`
- Main runtime dependencies include `@meteora-ag/dlmm`, Solana Web3, `node-cron`, OpenAI-compatible client, and `jsonrepair`.
- Current npm scripts: `start`, `dev`, `test:screen`, `test:agent`, `setup`.

## Current large/high-coupling modules

| Module | Approx. size | Current responsibility |
|---|---:|---|
| `index.js` | 45 KB | bootstrap, scheduling, management cycle, screening orchestration, Telegram lifecycle, briefing, state interactions, strategy interactions |
| `cli.js` | 29 KB | CLI routing and direct tool invocation |
| `lessons.js` | 26 KB | lessons, performance, threshold evolution |
| `agent.js` | 15 KB | LLM ReAct loop, role/tool routing, tool execution orchestration |
| `config.js` | 8 KB | environment/user config loading, risk/screening/management/strategy/schedule/LLM config, deploy sizing, dynamic screening reload |
| `tools/screening.js` | large | pool discovery, blacklist/dev filtering, enrichment, risk filters, ATH filtering, candidate selection |

## Current runtime flow

1. `index.js` loads environment and configuration.
2. Cron/scheduler starts management, screening, health/briefing related jobs.
3. Management cycle fetches open positions.
4. If no position exists, management can trigger screening.
5. Position data is snapshotted and pool memory is recalled.
6. Deterministic management rules evaluate exit/claim/stay conditions.
7. The agent/LLM is used where reasoning or instruction handling is required.
8. Screening obtains pool candidates, applies hard filters, enriches candidates, and returns eligible candidates.
9. Screening/management agents use the ReAct loop and tools to reason and act.
10. Execution ultimately reaches Meteora/Solana tools.

## Current screening behavior observed

`tools/screening.js` currently combines:

- Meteora Pool Discovery API collection
- pool-level hard filters
- blacklist filtering
- developer blocklist checks
- Jupiter developer enrichment when needed
- OKX enrichment for advanced/risk/price/cluster information
- wash-trading hard filtering
- ATH-distance filtering
- creator/developer blocklist checks
- occupied-pool and occupied-token exclusion

This is the primary candidate-pipeline refactor target.

## Current management behavior observed

`index.js` currently performs deterministic checks including:

- tracked-state hard exit
- stop loss
- take profit
- pumped-too-far above range
- stale out-of-range
- low fee yield
- fee claiming
- instruction-driven LLM handling
- PnL sanity protection
- management scheduling/busy protection

These rules must be preserved before being moved into a dedicated risk/exit engine.

## Current configuration behavior

`config.js` contains configurable values for:

- max positions and deployment limits
- pool screening thresholds
- fee/TVL and token-fee thresholds
- bundle/bot-holder/top-holder limits
- token age and ATH filters
- management/exit thresholds
- dynamic position sizing
- strategy and bin settings
- scheduling
- LLM temperature/token/step/model settings

`reloadScreeningThresholds()` already supports partial runtime updates from `user-config.json`. This is a useful capability to preserve and evolve into versioned tuning/configuration.

## Current tests

The repository currently contains two test scripts:

- `test/test-screening.js` — live Pool Discovery API smoke test and pool-detail test.
- `test/test-agent.js` — agent smoke test.

There is not yet a comprehensive deterministic regression suite for screening, scoring, management, exit decisions, or configuration changes.

## Phase 0 rule

No trading logic, threshold, API behavior, strategy, or execution behavior should be changed in this phase. Documentation and isolated baseline instrumentation are allowed only when they do not alter runtime behavior.
