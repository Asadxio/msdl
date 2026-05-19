# SECURITY_PHASE16_HARDENING_REPORT

## Current security architecture analysis
- Auth: Firebase Auth is used with realtime profile binding in `AuthContext`; role/status is fetched from `users` and navigation gates enforce admin/non-admin routing.
- Authorization: Firestore Rules already implement role helpers (`isAdmin`, `isModeratorOrAbove`, `isTeacherOrAdmin`) and collection-scoped constraints for users, notifications, payments, moderation, live classes, and reporting.
- Storage: client uploads use constrained path prefixes through `uploadUriFile` + media pipeline; content-type and size guards exist client-side.
- Realtime: broad use of `onSnapshot` across chat/status/live classes, with some dedupe/reliability support in `realtimeEngine`.
- Moderation: report collections + moderation actions exist, but report writes were fragmented and susceptible to duplicate/report-spam from UI paths.
- Security telemetry: security/observability engines exist, but several user actions still bypassed centralized guards.

## Security weakness analysis
- Client actions like status/message reporting were directly writable with weak anti-spam controls in surface code.
- Duplicate action prevention existed but was not consistently wired to high-abuse paths.
- Rate-limit foundations existed but were not uniformly applied to sensitive write operations.
- Moderation report payload shape risk: generic helper had schema drift potential against strict Firestore rule expectations.

## Abuse/scaling risk analysis
- Report spam and duplicate reporting can flood moderation queues.
- Without centralized sensitive-action guarding, abuse actors can burst actions across screens.
- Inconsistent security hooks increase operational blind spots and reduce trust in abuse analytics.

## Step-by-step implementation plan
1. Introduce a reusable sensitive-action guard combining replay protection + rate limiting + security telemetry.
2. Wire guard into chat and status report workflows (high abuse surfaces).
3. Normalize moderation report helper payloads to strictly match Firestore rule schemas per collection.
4. Add dev-only security diagnostics utility for local permission and session tracing safety.
5. Validate with backend compile + frontend typecheck baseline, and document residual risks.

## Implemented hardening
- Added centralized `guardSensitiveAction` in `frontend/lib/securityHardening.ts`.
- Integrated guarded report submission in chat message reporting and status reporting.
- Fixed moderation report helper payloads to match `status_reports` and `message_reports` rule contracts.

## Remaining recommendations
- Expand sensitive action guard to reactions, payment confirm retries, and upload abuse entry points.
- Add server/API-side report dedupe keys for defense in depth.
