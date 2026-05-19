# Media Phase 10 Optimization Report

## Architecture analysis
Current media uploads are centralized through `uploadUriFile` -> `mediaPipeline`, with category-aware storage paths and resumable Firebase uploads.

## Identified bottlenecks
- No centralized preprocessing orchestration for media optimization.
- Limited duplicate suppression and cache governance across categories.
- Retry state existed but lacked optimization-aware heartbeat integration.

## Optimization strategy
- Add `mediaOptimization.ts` as a reusable preprocessing and lifecycle governance layer.
- Integrate optimization into `mediaPipeline` while preserving `uploadUriFile(...)` compatibility.
- Add integrity hash + duplicate suppression window + cache registry.
- Add heartbeat/retry scheduling hooks for background reliability.

## Lifecycle diagram (text)
1. enqueue request
2. preprocess media (image/video optimization)
3. validate optimized asset
4. duplicate suppression check
5. resumable upload start
6. heartbeat updates during state changes
7. success => cache registry update
8. failure => bounded retry scheduling

## Retry model
- exponential backoff via `scheduleRetry`
- bounded retry ceiling
- retry state persisted in heartbeat store

## Cache model
- media cache key generation via category/version/uri/size
- TTL registry for stale eviction
- post-upload cache registration and cleanup hooks

## Scaling risks
- true cross-platform video transcoding remains constrained by Expo runtime capabilities.
- chunked large-file uploads still future work.
- signed URL refresh orchestration should be expanded for expiring URL ecosystems.

## Future CDN recommendations
- add image CDN transform layer (resize/webp on delivery)
- edge caching with invalidation by cache key version
- media domain split by category and retention policy

## Future chunked-upload strategy
- adopt chunk manifest docs in Firestore
- resumable chunk commits with checksum verification
- chunk retry and missing-chunk reconciliation worker

## Production readiness assessment
- **8.1 / 10**: strong centralized optimization + integrity + reliability hooks; advanced transcoding/chunking still pending.
