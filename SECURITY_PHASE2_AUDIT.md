# Phase 2 Security Audit & Hardening Report

## Scope
- `frontend/app/**`, `frontend/lib/**`, `frontend/context/**`
- `backend/**`
- `firestore.rules`, `storage.rules`

## Risk Findings (Prioritized)
1. **High — Replay and duplicate quiz submission risk**
   - Endpoint `/api/lms/quiz/submit` previously only deduped on attempt key and had no operation-level replay key.
   - Abuse path: repeated API retries with altered nonce/op timing.
2. **High — Missing adaptive lockout for burst abuse**
   - Existing rate limit allowed hard cap but no temporary lockout policy for sustained abuse.
3. **Medium — Timestamp skew acceptance in critical submissions**
   - Quiz attempts accepted client timestamps without freshness checks.
4. **Medium — Limited frontend anti-flood helper for UX-safe suppression**
   - No shared local client-side limiter utility for preflight suppression.
5. **Medium — Security observability was present but lacked expanded quiz anomaly events**
   - Some event logging existed, but no suspicious timing event for anti-cheat triage.

## Exploitability and Scale Risk
- Low-cost scripted abuse can cause write storms (`quiz_attempt_locks`, `quiz_results`) and noisy retries.
- Replay from unstable mobile networks could bypass naive dedupe and inflate storage/write costs.
- At large beta scale, this can become operationally expensive and moderation-noisy.

## Hardening Implemented
- Added operation-level dedupe key support for quiz submission.
- Added timestamp freshness validation for anti-replay skew defense.
- Added suspicious timing detection event + persisted signal.
- Added adaptive abuse lockout primitive in backend rate limiter.
- Added shared frontend rate-limit utility for low-friction local suppression.

## Remaining Risks
- In-memory lockout state resets on process restart (acceptable for additive phase; migrate to Redis/Firestore lease map later).
- Additional high-risk flows (attendance/certificate issuance) should be migrated to callable server-authoritative endpoints in next increment.
- Firestore rules should include stricter immutable field surfaces for all LMS subcollections if not already enforced.

## Attack Simulations Recommended
- Burst replay with repeated `x-op-id` per user.
- Nonce rotation flood within one minute and lockout verification.
- Backdated/future-dated timestamps to validate rejection paths.
- Rapid-fire quiz completion under minimum human-time threshold.

## Production Readiness Impact
- Improves resilience against replay, duplicate writes, and simple automation abuse.
- Preserves existing API shape and UX while adding bounded anti-abuse controls.
