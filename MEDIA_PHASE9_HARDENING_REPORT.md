# Media + Storage + Upload Hardening Report

## Current media architecture analysis
- Uploads were handled via `uploadUriFile` helper and invoked directly from chat/status/course/profile flows.
- Storage paths were separated by use case (`chat_media/*`, `status_updates/*`, `assignment_submissions/*`, `users/*`).
- Retry existed but was shallow (single immediate retry) and lacked persisted recovery queue.
- Media cache usage was partial (e.g., status player image prefetch) but not lifecycle-governed.

## Weakness analysis
- No centralized resumable upload manager with pause/resume/cancel semantics.
- Interrupted upload recovery across app restarts was weak.
- Failure states were fragmented across screens.
- Limited lifecycle metadata for upload debugging and governance.

## Storage/scaling risk analysis
- Retry storms and duplicate submits could increase storage and egress costs.
- Without queue persistence, large unstable uploads risk user-visible loss/restart loops.
- Inconsistent upload state synchronization can produce stale references.

## Step-by-step implementation plan
1. Add centralized media pipeline abstraction with persistent queue + resumable tasks.
2. Keep existing screen flows but route underlying helper through the new pipeline.
3. Enforce size/type/path validation centrally.
4. Add pause/resume/cancel/recover APIs.
5. Add upload-state observability hooks for development and ops.
6. Keep backward-compatible `uploadUriFile` API to avoid navigation/flow rewrites.

## Implemented
- Added `frontend/lib/mediaPipeline.ts`:
  - centralized upload categories
  - persistent queue (`AsyncStorage`) for recovery
  - resumable upload task wrapper (`uploadBytesResumable`)
  - pause/resume/cancel support
  - categorized failures and progress callbacks
  - recovery API (`recoverQueuedUploads`)
- Updated `frontend/lib/storage.ts` to delegate uploads into centralized pipeline while preserving existing `uploadUriFile` contract.

## Remaining risks
- Full video compression/transcoding pipeline remains future work (hooks can be added before enqueue).
- Offline binary staging for very large files may need chunked uploader strategy.
- Media cache eviction policy remains partially distributed across feature surfaces.

## Production readiness score
- **7.6 / 10** (major reliability and resumable foundations added; advanced compression/chunking/cross-surface cache lifecycle still pending).

## Large-file/network-failure stress tests
- Repeated network drop during upload with pause/resume/retry.
- App kill/restart followed by `recoverQueuedUploads` replay.
- Duplicate submit attempts for same media in unstable network.
- Large assignment file near size cap with progress and cancellation behavior.
