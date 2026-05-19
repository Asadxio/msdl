# PERFORMANCE_PHASE18_FEED_SCALABILITY_REPORT

## Bottlenecks found
- Status feed used direct `onSnapshot` listeners, increasing duplicate listener risk during navigation churn.
- Status comments listener also used direct subscription, causing avoidable listener pressure when expanding/collapsing threads repeatedly.
- Status feed list lacked hardened virtualization defaults for low-end Android.
- Media prefetch behavior had no bounded queue/concurrency controls on status feed surface.

## Optimization strategy
- Reuse `queryPerformance` deduped subscriptions with stable query keys.
- Add bounded image prefetch queue with low concurrency and viewport-prioritized candidates.
- Harden status feed list virtualization and clipped subview behavior.
- Add dev-only diagnostics for listener and prefetch pressure using existing performance metrics.

## Files changed
- `frontend/app/status.tsx`
- `PERFORMANCE_PHASE18_FEED_SCALABILITY_REPORT.md`

## Listener reductions
- Converted main status feed listener to `subscribeDeduped(stableQueryKey(...))`.
- Converted expanded comments listener to deduped keyed subscription.

## Virtualization improvements
- Added `initialNumToRender=6`, `maxToRenderPerBatch=6`, `updateCellsBatchingPeriod=45`, `windowSize=5`, `removeClippedSubviews=true`.
- Added stable `keyExtractor` callback and list empty memoization.

## Memory protections added
- Bounded prefetch queue and max in-flight prefetch concurrency (`2`).
- Viewport-aware prefetch candidate restriction to visible image items only.
- Dev diagnostics heartbeat for active listener counts and prefetch queue pressure.

## Remaining risks
- Dashboard home/status-player surfaces still need broader memoization and prefetch cancellation strategies.
- Full TS baseline remains blocked by existing repository issues unrelated to this patch.

## Future FlashList migration opportunities
- Status feed card list
- Home dashboard vertical featured sections
- Notifications feed under sustained large datasets

## Testing checklist
- Status updates creation and visibility
- Status list scrolling smoothness
- Media rendering correctness
- Comment expand/collapse realtime behavior
- Background/foreground transition stability
- Navigation churn listener duplication checks

## Low-end-device stress scenarios
- 30+ minute status scrolling session with frequent media cells
- Rapid status <-> tabs navigation switching
- Intermittent network with repeated listener reconnects
- High-volume status feed with frequent image updates
