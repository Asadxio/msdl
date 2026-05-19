# PERFORMANCE_PHASE20_FIRESTORE_SCALING_REPORT

## Bottlenecks identified
- Chat list used direct `onSnapshot` listeners for participant and broadcast streams, increasing duplicate-subscription risk during route churn.
- Home dashboard announcement stream used direct `onSnapshot` and could duplicate alongside other notifications listeners.
- Existing dedupe infrastructure was present but not consistently applied across all high-traffic feed/list surfaces.

## Listener reductions
- Migrated chat list participant and broadcast listeners to deduped subscriptions with stable keys.
- Migrated home announcements notifications stream to deduped subscription with stable key.

## Estimated read savings
- Reduced duplicate listener attachment risk on tab switch/mount churn for chat and dashboard announcement streams.
- Expected read reduction is workload-dependent; highest gains appear during repeated navigation and reconnect cycles where duplicate observers previously reattached.

## Query consolidation summary
- Reused `queryPerformance.subscribeDeduped` and `stableQueryKey` without schema changes.
- Kept existing query shapes (`where/orderBy/limit`) intact for behavior parity.

## Counter optimizations
- No counter schema change in this pass (additive-only safety).
- Existing unread badge logic remains intact while listener duplication risk is reduced.

## Reconnect improvements
- Deduped listeners reduce reconnect amplification by consolidating observer trees for shared query keys.

## Remaining expensive areas
- Additional direct `onSnapshot` usage remains in attendance/progress/certificate/about/admin pages.
- High-frequency write paths (typing, reactions) still warrant later batching optimization.

## Future scaling recommendations
- Expand dedupe wrapper to remaining read-heavy tabs.
- Introduce read-pressure sampling per query key in dev telemetry.
- Consider server-side aggregate documents for high-churn counters.

## Testing checklist
- Unread chat counts update correctly.
- Notifications announcements remain realtime.
- Tab switching does not duplicate listeners.
- Reconnect behavior preserves realtime updates.
- No stale state on feed/home screens.

## Files changed
- `frontend/app/(tabs)/chats.tsx`
- `frontend/app/(tabs)/index.tsx`
- `PERFORMANCE_PHASE20_FIRESTORE_SCALING_REPORT.md`
