# Meridian Current Architecture

## Runtime topology

```text
index.js
  |
  +-- config.js
  +-- node-cron
  +-- Telegram
  +-- agent.js
  +-- state.js
  +-- pool-memory.js
  +-- strategy-library.js
  +-- tools/dlmm.js
  +-- tools/wallet.js
  +-- tools/screening.js
  +-- lessons.js
  +-- smart-wallets.js
  +-- briefing.js
```

## Current responsibilities

### `index.js`
Acts as the application entry point and also owns a large portion of orchestration and management business logic. It starts timers, runs management/screening cycles, coordinates Telegram/briefing behavior, evaluates deterministic position rules, and invokes agent/tool functionality.

### `agent.js`
Implements the ReAct LLM loop. It builds the system prompt from current portfolio/state/memory, selects tools by role and intent, requires real tool usage for action-oriented requests, executes tool calls, and handles provider/tool-call failures.

### `config.js`
Loads `.env` plus `user-config.json`, builds the in-memory configuration, computes dynamic deployment amount, and supports runtime screening-threshold reload.

### `tools/screening.js`
Combines candidate discovery, hard filters, blacklist/dev-blocklist checks, external enrichment, risk filtering, ATH filtering, and candidate output shaping.

### `tools/dlmm.js`
Provides Meteora DLMM operations and position-related data access.

### `state.js`
Stores operational state and tracked position information.

### `pool-memory.js`
Stores/retrieves pool history and position snapshots/notes.

### `lessons.js`
Stores lessons/performance data and evolves screening thresholds.

### `strategy-library.js`
Contains strategy selection/library behavior.

## Architectural observation

The system already has useful domain modules, but the application layer is highly coupled. The main refactor objective is to move business logic out of the entry point and isolate data providers, candidate filtering, scoring, risk/exit decisions, strategy, LLM reasoning, and execution behind explicit contracts.

## Target direction

```text
Data adapters
   -> normalized domain objects
   -> candidate/filter/scoring engines
   -> strategy/risk/decision engines
   -> LLM reasoning where appropriate
   -> safety gate
   -> execution adapters
   -> journal/evaluation/tuning
```
