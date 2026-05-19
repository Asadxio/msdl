# Realtime Phase 12 Scaling Report

## Realtime architecture overview
- Added centralized `realtimeEngine` for subscription governance, presence lifecycle, reconnect coordination, deduplication, event batching, and health telemetry.

## Subscription lifecycle diagrams (text)
1. register subscription key -> ref-count increment
2. duplicate key reuses existing listener (dedupe)
3. unregister decrements refs -> teardown at zero
4. active subscription count tracked for observability

## Reconnect strategy
- bounded exponential reconnect with jitter
- reconnect attempt cap
- reconnect-safe heartbeat restart
- app foreground reconnect trigger

## Heartbeat model
- active heartbeat interval: 25s
- idle/background heartbeat interval: 55s
- paused/offline suppresses heartbeat

## Deduplication strategy
- event-id replay suppression
- stale event rejection via TTL
- bounded dedupe map pruning

## Reconciliation model
- batched event microqueue processing for frame-safe UI updates
- reconnect soft-sync hook to prevent callback storms

## Scaling bottlenecks
- at very large event rates, downstream screen reducers must remain incremental.
- potential future optimization: off-main-thread queue processing in native modules.

## Large-room considerations
- event batching, listener dedupe and subscription pruning reduce render storms.
- health metrics expose pressure indicators for operational tuning.

## Future websocket migration considerations
- keep `realtimeEngine` as abstraction boundary for swapping transport layer.
- preserve event dedupe and queue semantics independent of backend transport.

## Production readiness assessment
- **8.2 / 10**: strong centralized realtime coordination layer added; deeper per-feature reconciliation adapters can further improve large-room behavior.
