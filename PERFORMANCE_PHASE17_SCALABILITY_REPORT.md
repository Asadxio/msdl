# PERFORMANCE_PHASE17_SCALABILITY_REPORT

## Current performance architecture analysis
- The app already includes reusable performance/realtime/offline/media engines plus deduped-query utilities.
- High-traffic screens (chat/status/notifications/tabs) rely heavily on Firestore `onSnapshot`, with varying levels of listener coordination.
- Several large lists are virtualized with `FlatList`, but batch/window settings were inconsistent across heavy surfaces.

## Bottleneck analysis
- Duplicate realtime listeners can occur across route segments without enforced dedupe in all tabs-level subscriptions.
- Chat list render path had avoidable rerender triggers from inline list components and more aggressive-than-needed initial/batch list rendering.
- Lack of always-on dev listener diagnostics makes long-session leak detection harder.

## Memory/scaling risk analysis
- Large unread/listener fan-out in tabs can increase Firestore cost and memory retention.
- Chat long sessions risk JS thread churn from oversized initial render windows and repeated inline element creation.
- Without periodic diagnostics, leak detection in dev is delayed.

## Step-by-step optimization plan
1. Apply deduped listener subscription strategy in tabs-level realtime queries.
2. Add dev-only periodic listener metrics tracing to performance telemetry.
3. Tighten chat list virtualization and isolate footer/empty/key extractor references.
4. Keep all changes additive and API-compatible with existing Firebase/Expo architecture.
