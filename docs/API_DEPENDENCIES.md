# Meridian API Dependency Baseline

## Current external dependencies

| Provider | Current role | Refactor direction |
|---|---|---|
| Meteora DLMM SDK | DLMM pool/position operations and execution | Keep as execution/data adapter |
| Meteora Pool Discovery API | pool discovery and screening metrics | Keep behind adapter; may be supplemented/replaced by GMGN candidate discovery |
| Jupiter/Data API | token/developer enrichment and token data | Keep only where needed; isolate behind adapter |
| OKX OnchainOS | advanced token risk/cluster/price enrichment in current screening implementation | Remove from target architecture; replace with GMGN/private-server equivalents where available |
| OpenRouter/OpenAI-compatible endpoint | LLM inference | Keep provider-agnostic adapter |
| Solana RPC | on-chain data and transaction infrastructure | Keep behind Solana adapter |
| Telegram | notifications/chat | Keep as transport/integration layer |
| Optional Discord listener | external token signals | Keep optional and isolated from core screening |

## Target provider boundaries

Meridian business logic must not depend directly on provider URLs or response shapes.

```text
Provider
  -> Adapter
  -> Normalized Domain Object
  -> Engine
```

## Target candidate intelligence

Primary candidate/token intelligence direction:

```text
GMGN
  -> GMGN adapter
  -> Candidate/Token/Security normalized objects
```

DLMM truth/execution:

```text
Meteora
  -> Meteora adapter
  -> Pool/Position/Execution objects
```

Derived indicators:

```text
Private Indicator Server
  -> Indicator adapter
  -> IndicatorProfile
```

## Data-quality requirement

Every external data response used for a decision should eventually carry source, timestamp/age, availability, and validity information. Missing or stale critical data must not silently become a PASS condition.

## Phase 0 note

This file records the dependency baseline only. Provider replacement is a later refactor phase and must not be mixed into the Phase 0 behavior freeze.
