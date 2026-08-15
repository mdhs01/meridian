# Core / Scheduler Refactor v2

## Phase 3 scope

Phase 3 isolates infrastructure lifecycle concerns from Meridian business logic.

### Scheduler responsibilities

The scheduler owns:

- cron registration
- interval normalization
- task start/stop
- management/screening concurrency guards
- health scheduling
- briefing scheduling
- briefing watchdog scheduling
- lightweight PnL polling scheduling
- scheduler runtime state

Scheduler runtime state is isolated in `app/scheduler-state.js` and contains only scheduling/lifecycle markers. It does not contain positions, strategy state, or trading decisions.

The scheduler does **not** own:

- screening rules
- candidate selection
- risk decisions
- strategy logic
- LLM prompts
- blockchain execution

Those are injected as callbacks.

## Lifecycle responsibilities

`app/lifecycle.js` owns graceful shutdown semantics:

1. stop scheduler
2. stop Telegram polling
3. inspect open positions
4. log shutdown state
5. exit

Trading logic remains outside the lifecycle service.

## Phase 3A.1 — Runtime adapter

`app/runtime.js` provides the callback boundary between Meridian cycle implementations and infrastructure services. It does not implement management, screening, or trading logic.

## Phase 3A.2 — Scheduler state

`app/scheduler-state.js` extracts mutable scheduling state into a per-scheduler state object. The state tracks:

- started/stopped status
- management busy flag
- screening busy flag
- PnL poll busy flag
- management last-run timestamp
- screening last-run timestamp
- screening trigger timestamp
- PnL trigger timestamp

The legacy `index.js` still owns its existing copies during the migration. They are intentionally not deleted until Phase 3A.3/3A.4 wiring and regression verification are complete.

## Compatibility rule

The legacy `index.js` remains the active entrypoint during the migration. Phase 3 introduces the isolated services first; wiring them into the legacy entrypoint is a separate migration step so scheduler extraction cannot silently change trading behavior.

## Target flow

```text
index/bootstrap
      |
      +--> runtime adapter
                |
                +--> scheduler --> management callback
                |             --> screening callback
                |             --> health callback
                |             --> briefing callback
                |             --> PnL poll callback
                |
                +--> scheduler-state
      |
      +--> lifecycle --> scheduler.stop()
                    --> polling.stop()
                    --> position inspection
```

## Concurrency invariant

At most one management cycle and one screening cycle may be active through the scheduler at a time. The scheduler does not decide whether a cycle is economically safe; it only prevents overlapping invocations.
