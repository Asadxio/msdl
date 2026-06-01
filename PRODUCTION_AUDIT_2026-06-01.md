# Production-Grade Audit — 2026-06-01

## Scope and methodology

This audit traces the repository code paths that exist in this checkout. It does not assume behavior that is not represented in code. Evidence is cited as `file:line` ranges from the current tree. Areas reviewed: runtime stability, Firebase rules/indexes, Agora live classes, payments, notifications, uploads, chat/status/moderation, admin tools, privacy/compliance, performance, security, and production operations.

## Executive decision

- **Production readiness score:** **58 / 100**.
- **Would I personally approve public launch today?** **No**. The app has strong feature coverage, but several launch-blocking mismatches exist between client writes and Firestore rules, Play Store data disclosures, live-class state models, admin access assumptions, and payment/retention workflows.
- **Primary launch risk:** Hidden failures are more likely from authorization/rules mismatches and data-policy drift than from obvious UI bugs.

## A. Top 10 launch blockers (P0)

1. **Play Store Data Safety / runtime location mismatch.** The APK requests precise/coarse location and the home screen auto-calls foreground location permission, while the Data Safety checklist says approximate and precise location are not collected. Evidence: `frontend/app.json:16-17`, `frontend/app.json:28-29`, `frontend/app/(tabs)/index.tsx:460-464`, `frontend/app/(tabs)/index.tsx:616-623`, `docs/play-store-data-safety.md:24-25`.
2. **Live-class participant writes are denied by Firestore rules.** Client writes `hand_raised`, `moderation`, `reconnect_count`, `disconnected`, `session_id`, `joined_session_at`, `last_reconnected_at`, `total_connected_duration`, and heartbeat fields; rules allow only a smaller field set. Evidence: `frontend/lib/liveClasses.ts:364-392`, `firestore.rules:636-652`.
3. **Live-class reconnect statuses are inconsistent with rules.** Client model accepts `waiting_room`, `paused`, and `reconnecting`, and runtime writes `reconnecting`; rules only accept `scheduled`, `live`, `ended`, and `cancelled`. Evidence: `frontend/lib/liveClasses.ts:149-152`, `frontend/app/live-class/[id].tsx:472-481`, `firestore.rules:605-621`.
4. **Status audience privacy is enforced only on the client.** Rules allow every signed-in user to read every `status_updates` document; client filters audience locally after downloading. Evidence: `firestore.rules:897-900`, `frontend/app/status.tsx:118-147`.
5. **Backend can fail at import/startup if MongoDB env is missing.** `os.environ['MONGO_URL']` and `os.environ['DB_NAME']` execute at module import before the app starts. Evidence: `backend/server.py:51-57`.
6. **Admin UI blocks `super_admin` at the global route gate.** RBAC grants `super_admin` admin permissions, but `AuthGate` treats only `profile.role === 'admin'` as admin for `/admin/*`. Evidence: `frontend/lib/rbac.ts:16-24`, `frontend/app/_layout.tsx:37-55`.
7. **Payment success can grant entitlement by admin/manual state without provider proof in the finalizer path.** Admin action `succeeded` directly calls `finalize_successful_payment`, which activates enrollments/subscriptions; the finalizer trusts current payment document fields and has no provider receipt check. Evidence: `backend/server.py:1523-1548`, `backend/payments/payment_finalizer.py:21-56`.
8. **Public account deletion is request-only; no code path performs deletion/export completion.** App/web create `privacy_requests`; admin screen only advances states and does not delete/anonymize Auth, Firestore, Storage, chat/status/media, or exports. Evidence: `frontend/lib/legal.ts:87-96`, `web/account-deletion.html:81-93`, `frontend/app/admin/privacy-requests.tsx:85-93`.
9. **Permanent user delete in admin removes only the Firestore profile.** It does not delete Firebase Auth, public profile, subcollections, chat/status/media, payments, tokens, enrollments, or storage. Evidence: `frontend/app/admin/users.tsx:130-151`.
10. **Live-class reconnect recovery does not rejoin.** On reconnecting state, the handler schedules `leaveChannel()` but does not call `joinChannel()` again in that path; it only updates UI diagnostics. Evidence: `frontend/app/live-class/[id].tsx:472-498`, `frontend/app/live-class/[id].tsx:568-576`.

## B. Top 10 hidden risks

1. **Rules/schema drift is recurring.** Live participant documents and live-class statuses already diverge from rules; future features will silently fail unless schema compatibility tests are added. Evidence: `frontend/lib/liveClasses.ts:364-392`, `firestore.rules:636-652`.
2. **Sensitive status content can leak to signed-in users outside audience.** Even if UI hides it, an approved signed-in client can query raw documents because rules allow read. Evidence: `firestore.rules:897-900`, `frontend/app/status.tsx:140-147`.
3. **Unbounded reads will become cost/performance problems.** Data provider reads full `courses`, `teachers`, and `library` collections; status feed subscribes to all status updates; admin privacy requests fetch all requests. Evidence: `frontend/context/DataContext.tsx:223-241`, `frontend/context/DataContext.tsx:259-287`, `frontend/app/status.tsx:118-123`, `frontend/app/admin/privacy-requests.tsx:53-58`.
4. **Audio message uploads are routed through image optimization.** Non-video uploads use `optimizeImageForUpload`, so chat audio selected with `contentType` such as `audio/mpeg` is passed into an image manipulator before upload. Evidence: `frontend/app/chat/[id].tsx:440-459`, `frontend/app/chat/[id].tsx:483-489`, `frontend/lib/mediaPipeline.ts:67-70`, `frontend/lib/mediaOptimization.ts:59-79`.
5. **Push broadcasts scan the entire users collection.** `send_to_all` streams all `users`, which will become slow and expensive and can time out at scale. Evidence: `backend/server.py:982-985`.
6. **Expo push retry is synchronous in the request path.** The backend sleeps, polls receipts, and retries inside `/push/send`, tying up the request and increasing timeout risk. Evidence: `backend/server.py:681-707`.
7. **Home screen asks for location automatically.** This is poor UX and policy-sensitive because permission is requested on mount rather than after a clear user action. Evidence: `frontend/app/(tabs)/index.tsx:616-623`.
8. **Payment operation IDs are timestamp-based and not resilient across app restarts.** Manual confirmation generates `operationId` from `Date.now()`, so retries after restart create new payment documents rather than resuming the same operation. Evidence: `frontend/app/payment.tsx:161-179`, `backend/security/paymentSecurity.py:29-30`.
9. **Privacy request public form does not verify email ownership.** The public page signs in anonymously and stores the entered email inside the reason text, so support must manually verify identity before action. Evidence: `web/account-deletion.html:81-93`.
10. **Many catches swallow operational errors.** Critical paths suppress failures, including public profile sync, participant join/leave attendance events, and notification registration, reducing observability. Evidence: `frontend/context/AuthContext.tsx:106-117`, `frontend/lib/liveClasses.ts:393-397`, `frontend/lib/pushNotifications.ts:137-140`.

## Detailed findings by area

### 1. App crashes & runtime stability

| Severity | Issue | Exact file(s) | Root cause | Real-world impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| P0 | Backend startup can crash before health checks. | `backend/server.py:51-57` | Required env vars are accessed with `os.environ[...]` at import time. | Railway/container starts fail with `KeyError` instead of a controlled unhealthy state if `MONGO_URL` or `DB_NAME` is absent. | Use `os.environ.get`, validate in startup, and make `/health` expose missing dependency status without preventing import. |
| P1 | Status player can leave users stuck on a loading overlay for text-only status. | `frontend/app/status-player.tsx:23-31`, `frontend/app/status-player.tsx:96-101` | `loading` is reset to `true` for every item, but text-only media never calls `setLoading(false)`. | Text-only story displays can show a spinner forever. | Set `loading=false` when `!current.media_url`, and on index changes for non-media items. |
| P1 | Many async failures are swallowed. | `frontend/context/AuthContext.tsx:106-117`, `frontend/lib/liveClasses.ts:393-397`, `frontend/lib/pushNotifications.ts:137-140` | `catch(() => {})` or console-only handling in production paths. | Silent data drift: public profile, live attendance, and push registration can fail without alerting support. | Route errors through `reportError`/backend audit logs with context and sampling. |
| P1 | Live cleanup callback captures stale `classId` and omits it from dependencies. | `frontend/app/live-class/[id].tsx:210-242` | `cleanupAgora` uses `classId` for metrics while dependency array is empty. | Metrics can be attributed to an empty or stale class; harder incident triage. | Add dependency or pass `classId` as an argument. |
| P2 | Profile cache parses JSON twice. | `frontend/context/AuthContext.tsx:147-151` | `JSON.parse(cachedProfile)` is invoked twice inside the same branch. | Minor CPU overhead and duplicate parse failure surfaces. | Parse once and reuse the object. |

### 2. Firebase rules, indexes, authentication, cleanup

| Severity | Issue | Exact file(s) | Root cause | Real-world impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| P0 | Live participant writes are denied. | `frontend/lib/liveClasses.ts:364-392`, `firestore.rules:636-652` | Client participant schema contains fields not allowed by rules. | Participant presence, reconnect count, heartbeat, and attendance state can fail even after Agora join. | Align rules and client schema; add rules unit tests for `markParticipantJoined`, heartbeat, and `markParticipantLeft`. |
| P0 | Live status enum mismatch. | `frontend/lib/liveClasses.ts:149-152`, `firestore.rules:614-615` | Client supports more statuses than rules. | Teachers cannot reliably mark `reconnecting`, `paused`, or waiting-room states. | Create one shared enum and update rules/client together. |
| P0 | Status privacy is not rule-enforced. | `firestore.rules:897-900`, `frontend/app/status.tsx:118-147` | Rules allow all signed-in reads; audience filtering happens after download. | Private teacher/student/custom statuses are readable by unintended signed-in users. | Add audience checks in rules or denormalize per-recipient feed documents. |
| P0 | Admin permanent delete is incomplete. | `frontend/app/admin/users.tsx:130-151` | Deletes only `users/{uid}`. | Orphan Auth accounts, Storage files, public profiles, messages, tokens, enrollments, payments, and compliance records remain. | Replace direct delete with backend deletion workflow that deletes/anonymizes all related records transactionally/batched. |
| P1 | `super_admin` is supported in rules/RBAC but blocked in route gate. | `firestore.rules:17-33`, `frontend/lib/rbac.ts:16-24`, `frontend/app/_layout.tsx:37-55` | Route gate only checks `profile?.role === 'admin'`. | Highest-privilege operator cannot access admin screens. | Use `hasPermission(profile, 'admin.dashboard.read')` or include `super_admin`. |
| P1 | Unbounded privacy request and status queries. | `frontend/app/admin/privacy-requests.tsx:53-58`, `frontend/app/status.tsx:118-123` | No `limit`/pagination on growing collections. | Slow screens and high Firestore cost as records accumulate. | Add pagination/limits and archival/TTL jobs. |
| P1 | User list indexing may fail for combined filters. | `frontend/app/admin/users.tsx:47-57`, `firestore.indexes.json` | Admin list can combine `role ==`, `status ==`, and `orderBy(created_at desc)`, but indexes only include `status+role` without `created_at`. | Firestore may throw missing-index errors in filtered admin lists. | Add composite indexes for `role,status,created_at desc` and common single-filter orderings. |

### 3. Live Classes (Agora)

| Severity | Issue | Exact file(s) | Root cause | Real-world impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| P0 | Firestore presence write fails despite Agora join. | `frontend/app/live-class/[id].tsx:461-470`, `frontend/lib/liveClasses.ts:364-392`, `firestore.rules:636-652` | `markParticipantJoined` is called after join, but rules reject its fields. | User can be in Agora but invisible/untracked in participants and attendance. | Fix schema/rules and stop swallowing join tracking failures. |
| P0 | Reconnect flow leaves the channel but does not rejoin. | `frontend/app/live-class/[id].tsx:472-498`, `frontend/app/live-class/[id].tsx:568-576` | Reconnect timer calls `leaveChannel()` only. | Network interruption can strand users until manual rejoin. | Store last token/channel/uid and call `joinChannel()` after leave, or use Agora reconnect callbacks without manual leave. |
| P0 | Reconnecting status update can be denied. | `frontend/app/live-class/[id].tsx:480-481`, `firestore.rules:614-615` | Runtime writes `reconnecting`; rules reject it. | Teacher status indicator and recovery state may not persist. | Add `reconnecting` to allowed statuses or stop writing it. |
| P1 | Permissions are Android-only in custom code. | `frontend/app/live-class/[id].tsx:82-90`, `frontend/app.json:13-18` | `requestClassroomPermissions` returns true for non-Android and relies on native/Agora prompts. | iOS users may receive late or unclear camera/mic prompts/failures. | Add explicit Expo/React Native camera/mic permission flow for iOS and Android. |
| P1 | Token renewal failure only logs. | `frontend/app/live-class/[id].tsx:538-555` | Renewal failures are `console.log` only and do not show UI fallback or retry policy. | Long classes can fail silently near token expiry. | Add bounded retry, user-visible reconnect banner, and metrics/error reporting. |
| P2 | Default speaker route and current-route switch are split. | `frontend/app/live-class/[id].tsx:461-466`, `frontend/app/live-class/[id].tsx:558-563` | Default route is set before join and current route after join. | Correct direction, but should be regression-tested on Android variants/Bluetooth. | Add instrumentation around audio route callbacks and device-matrix QA. |

### 4. Payments

| Severity | Issue | Exact file(s) | Root cause | Real-world impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| P0 | Admin/manual success grants entitlement without provider verification. | `backend/server.py:1523-1548`, `backend/payments/payment_finalizer.py:21-56` | Admin action can transition processing payment to `succeeded`; finalizer activates enrollment/subscription without checking Razorpay evidence. | Incorrect activation if admin mistakes or fraudulent references are approved. | Require provider receipt/order verification or two-person approval for high-risk/manual payments; store immutable evidence. |
| P1 | Payment operation ID is not stable across retries. | `frontend/app/payment.tsx:161-179`, `backend/security/paymentSecurity.py:29-30` | Client creates `operationId` with `Date.now()`. | Duplicate pending/processing payments after retry, app restart, or double tap. | Persist current operation in local storage/server, reuse until terminal state, and disable repeated confirms. |
| P1 | Webhook payment mapping is fragile. | `backend/server.py:1573-1577`, `backend/server.py:1595-1608` | Webhook expects a top-level/nested `payment_id` to be the internal document id. The app opens a static payment link and creates internal IDs separately. | Captured Razorpay events may not map to internal payment docs, so reconciliation fails or updates wrong IDs if payload shape differs. | Create Razorpay orders/links server-side with internal receipt metadata/notes and verify callbacks against those IDs. |
| P1 | Invalid payment validator exceptions are not translated consistently. | `backend/server.py:1460-1464`, `backend/validators/payment_validator.py:2-13` | `ValueError` from validators is not caught in `/payments/initiate`. | Bad client input can produce 500 instead of 400. | Catch validation errors and raise `HTTPException(400)`. |
| P2 | Stale processing recovery uses a magic reference prefix. | `backend/jobs/payment_reconciliation.py:31-42` | References starting with `ok_` are treated as recoverable success. | Operational convention can be misunderstood and grant success incorrectly. | Replace with provider lookup or explicit admin action requiring evidence. |

### 5. Notifications

| Severity | Issue | Exact file(s) | Root cause | Real-world impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| P1 | Broadcast push streams every user synchronously. | `backend/server.py:982-985`, `backend/server.py:1040-1083` | `send_to_all` streams the whole users collection inside an HTTP request. | Timeouts and high read cost as user base grows. | Queue fanout jobs and page through users. |
| P1 | Expo push receipt polling and retry happen in request path. | `backend/server.py:681-707` | Handler sleeps, polls receipts, and retries before returning. | Slow API requests and worker starvation under load. | Move receipts/retries to async job queue. |
| P1 | Token registration failure is silent. | `frontend/lib/pushNotifications.ts:106-140` | Errors are logged and `null` returned with no telemetry/user state. | Users may miss important class/payment notifications. | Persist token registration status and send telemetry/retry schedule. |
| P2 | Push permission can be requested automatically after login. | `frontend/app/_layout.tsx:94-112`, `frontend/lib/pushNotifications.ts:115-120` | Root effect registers token, and registration requests permission. | Users see a permission prompt without feature context. | Ask at feature moment or settings screen with rationale. |

### 6. Media uploads

| Severity | Issue | Exact file(s) | Root cause | Real-world impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| P1 | Audio chat upload is broken. | `frontend/app/chat/[id].tsx:440-459`, `frontend/lib/mediaPipeline.ts:67-70`, `frontend/lib/mediaOptimization.ts:59-79` | Non-video files are treated as images in the media pipeline. | Audio attachments fail or throw native image manipulation errors. | Add an audio path that validates size/type and uploads without image manipulation. |
| P1 | Upload queue does not auto-resume across app restarts. | `frontend/lib/mediaPipeline.ts:39-57`, `frontend/lib/mediaPipeline.ts:60-120` | Queue is persisted, but no startup worker scans and resumes pending uploads. | Failed/offline uploads remain stuck until another screen-specific flush happens. | Add global media upload worker on app start and network restore. |
| P1 | Original videos are uploaded without transcoding. | `frontend/lib/mediaOptimization.ts:82-101` | Video optimizer only thumbnails/preflights and keeps original URI. | Large videos hit limits, waste bandwidth, and fail on slow networks. | Add native transcoding/compression or stricter duration/size UX. |
| P2 | Upload duplicate suppression can block legitimate retries. | `frontend/lib/mediaPipeline.ts:71-72`, `frontend/lib/mediaOptimization.ts:149-158` | Duplicate window is based on content hash only. | User may be unable to resend same media within the window. | Scope duplicate suppression by target path/context and expose retry override. |

### 7. Chat & Status moderation / abuse

| Severity | Issue | Exact file(s) | Root cause | Real-world impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| P0 | Status audience leaks at rules layer. | `firestore.rules:897-900`, `frontend/app/status.tsx:118-147` | Access control is client-side only. | Privacy breach for restricted statuses. | Move audience check to Firestore rules or per-recipient feed docs. |
| P1 | Chat messages have no rule-level length or media URL ownership validation. | `firestore.rules:441-463` | Rules require `text` string but do not cap length; `media_url` only type-checks. | Spam, very large documents, or links to unrelated media can be written. | Add text length, media URL/path ownership checks, and server moderation queue. |
| P1 | Reporting can be spammed and does not validate target existence. | `frontend/lib/ugcReports.ts:23-41`, `firestore.rules:1204-1211` | Report create only checks reporter/state/severity/time fields. | Fake reports inflate moderation workload. | Require target id/type schema, existence checks where possible, rate limits, and dedupe. |
| P1 | Status feed is unbounded. | `frontend/app/status.tsx:118-123` | No `limit`, no server-side active status filter. | Cost and latency grow with expired statuses. | Add `where(expires_at_ms, '>', now)`, `limit`, index, and archival cleanup. |
| P2 | Comments/reactions lack rate limiting. | `frontend/app/status.tsx:385-426`, `firestore.rules:904-928` | Rules allow signed-in writes without velocity controls. | Spam/abuse burst risk. | Add backend/rules-backed rate limiting or moderation thresholds. |

### 8. Admin features

| Severity | Issue | Exact file(s) | Root cause | Real-world impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| P0 | `super_admin` cannot pass route gate. | `frontend/app/_layout.tsx:37-55`, `frontend/lib/rbac.ts:16-24` | Global route logic hard-codes only `admin`. | Super admins are locked out of admin screens despite RBAC/rules support. | Gate by `hasPermission`. |
| P0 | Permanent delete is unsafe/incomplete. | `frontend/app/admin/users.tsx:130-151` | Direct `deleteDoc(users/{uid})`. | Orphaned records and possible compliance failure. | Use backend account lifecycle job. |
| P1 | Admin user updates bypass backend nonce/audit hardening. | `frontend/app/admin/users.tsx:74-87`, `backend/server.py:185-196` | User management writes directly to Firestore; hardened capability checks only apply to backend endpoints. | Less replay protection and inconsistent audit semantics. | Move high-risk user changes to backend privileged endpoints. |
| P1 | Bulk status can include current admin. | `frontend/app/admin/users.tsx:88-99` | No self-exclusion before batch update. | Admin can deactivate/reject themselves and lose access. | Exclude `auth.currentUser.uid` and require confirmation for privileged accounts. |
| P2 | Admin privacy requests are unpaginated. | `frontend/app/admin/privacy-requests.tsx:53-58` | Fetches all requests. | Slow admin screen as volume grows. | Add pagination. |

### 9. Privacy & compliance

| Severity | Issue | Exact file(s) | Root cause | Real-world impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| P0 | Location disclosure mismatch. | `frontend/app.json:16-17`, `frontend/app.json:28-29`, `frontend/app/(tabs)/index.tsx:460-464`, `docs/play-store-data-safety.md:24-25` | Build requests/uses location but checklist says not collected. | Play Store rejection or inaccurate Data Safety declaration. | Update Data Safety/privacy policy or remove location permissions and auto request. |
| P0 | Account deletion is not implemented end-to-end. | `frontend/lib/legal.ts:87-96`, `frontend/app/admin/privacy-requests.tsx:85-93` | Requests can be marked completed without deletion/export automation. | Compliance and user trust risk. | Implement deletion/export backend jobs with audit and retained-record policy. |
| P1 | Public deletion form lacks identity verification. | `web/account-deletion.html:81-93` | Anonymous auth creates request based on typed email. | Support can receive fraudulent requests and must manually verify. | Send verification email or require login/token challenge. |
| P1 | Privacy request admin state change has no lifecycle append. | `frontend/app/admin/privacy-requests.tsx:85-93` | Only updates `state` and `updated_at`. | Audit trail for deletion/export processing is incomplete. | Append immutable lifecycle entries with actor and timestamp. |
| P2 | Policy versions are hard-coded in app. | `frontend/lib/legal.ts:14-39` | Policy bundle lives in code, requiring app release for policy version changes. | Slow policy update rollout. | Fetch active policy versions from backend/app settings. |

### 10. Performance

| Severity | Issue | Exact file(s) | Root cause | Real-world impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| P1 | Data provider performs large collection reads at startup. | `frontend/context/DataContext.tsx:223-287`, `frontend/context/DataContext.tsx:361-411` | Full `library`, `courses`, `teachers`; admin and empty-course paths read up to 1200/1500 modules/lessons/assignments. | Slow startup and high Firestore cost as data grows. | Paginate and lazy-load by screen/course. |
| P1 | Status feed subscribes to all statuses. | `frontend/app/status.tsx:118-123` | No active filter/limit. | Feed gets slower over time and downloads hidden/expired records. | Query only active visible feed docs. |
| P1 | Push send endpoint performs fanout synchronously. | `backend/server.py:982-985`, `backend/server.py:1047-1083` | Reads users, sends FCM/Expo, polls receipts in request. | Timeouts under larger broadcasts. | Use queued fanout workers. |
| P2 | Dev-only performance metrics exist but production crash analytics are minimal. | `frontend/app/_layout.tsx:71-92` | Global handler reports errors, but many operational paths only log. | Some performance/operational regressions are not visible. | Standardize production telemetry. |

### 11. Security

| Severity | Issue | Exact file(s) | Root cause | Real-world impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| P0 | Client-side status audience filtering leaks data. | `firestore.rules:897-900`, `frontend/app/status.tsx:140-147` | Authorization not enforced at the database layer. | Unauthorized status reads by signed-in users. | Enforce audience in rules or per-user fanout docs. |
| P0 | Manual payment success can grant entitlement without cryptographic proof. | `backend/server.py:1542-1545`, `backend/payments/payment_finalizer.py:32-56` | State transition to `succeeded` is enough to activate. | Fraud/incorrect access activation. | Verify provider evidence and require immutable audit. |
| P1 | Backend privileged nonce cache is in-memory only. | `backend/server.py:149-159` | Replay protection is process-local. | Replay protection resets on deploy and does not work across multiple instances. | Store nonces in Redis/Firestore with TTL. |
| P1 | Push non-admin role check ignores `super_admin`. | `backend/server.py:975-980` | `is_admin = requester_role == "admin"`. | Super admins cannot broadcast push through this endpoint. | Use role set `{'admin','super_admin'}`. |
| P1 | Chat media URL not bound to storage path in message rules. | `firestore.rules:441-463`, `storage.rules:97-103` | Storage write path is protected, but message can point to any string URL. | Users can attach URLs they did not upload/control. | Validate URL prefix/path owner or write messages via backend after upload. |

### 12. Production readiness / operations

| Severity | Issue | Exact file(s) | Root cause | Real-world impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| P0 | Missing env crash prevents graceful degraded health. | `backend/server.py:51-57`, `backend/server.py:76-78` | Health endpoint always returns `ok` if module imports, but import can fail before app exists. | Deployment can fail without useful health diagnostics. | Implement startup dependency checks and detailed `/health`. |
| P1 | No demonstrated backup/restore workflow in executable code. | `docs/runbooks/incident-response.md`, repository scan | Runbook exists, but no scheduled Firestore/Storage backup job was found in code paths reviewed. | Data loss recovery depends on manual/cloud-console setup. | Add documented scheduled exports and restore drills. |
| P1 | Privacy deletion/export workflow is manual state only. | `frontend/app/admin/privacy-requests.tsx:85-93` | No worker executes requests. | Legal SLA risk. | Add backend jobs with audit events. |
| P1 | Logs are inconsistent and console-heavy in mobile. | `frontend/lib/pushNotifications.ts:137-140`, `frontend/app/status.tsx:232-234`, `frontend/app/live-class/[id].tsx:538-555` | `console.log` is used instead of structured reporting in several production paths. | Support cannot correlate failures by user/session. | Use central `reportError`/metrics with redaction. |
| P2 | Existing readiness script checks env presence but not rules/client compatibility. | `frontend/scripts/release-readiness-check.mjs`, `firestore.rules` | Readiness checks do not simulate Firestore writes. | Rules drift ships unnoticed. | Add emulator tests for critical client write shapes. |

## Recommended remediation sequence

1. Fix Firestore rules/client schema drift for live classes and status privacy.
2. Resolve Play Store location disclosure: either remove location permissions/auto prompt or update Privacy/Data Safety and consent UX.
3. Replace unsafe account/user deletion paths with a backend lifecycle workflow.
4. Harden payment finalization around verified provider evidence or explicit manual dual-control.
5. Fix admin route gate and role handling for `super_admin`.
6. Implement live-class reconnect rejoin and token-renewal observability.
7. Add pagination/limits for status, privacy requests, and global data reads.
8. Move push broadcasts and receipt polling to background jobs.
9. Fix audio upload path and add media resume worker.
10. Add emulator/security tests for representative writes: live participant join/leave, status visibility, payments, admin user changes, reports.

## Evidence commands used

- `git status --short && git log --oneline -5`
- `find .. -name AGENTS.md -print`
- `rg --files -g '!node_modules' -g '!ios/Pods' -g '!android/.gradle'`
- `rg -n "match /|allow |function isValidLive|function canRead|function canJoin|function isValidPayment|function isValidReport|function isValidNotification|function isValidStatus|function isValidChat|function isValidMessage|function isValidPrivacy" firestore.rules`
- `rg -n "delete|remove|reauth|privacy|signOut|onAuthStateChanged|createUserWithEmail|setDoc|updateDoc|getDocs|onSnapshot|query\(|where\(|limit\(|orderBy\(|addDoc|uploadBytes|uploadBytesResumable|Blob|fetch\(|Alert.alert|catch \(\)|catch \{\}|console\.log|Razorpay|payment|signature|webhook|token|notifications|expo_push|fcm" frontend/app frontend/lib frontend/context backend -S -g '!node_modules'`
- Targeted `nl -ba ... | sed -n ...` inspections for every cited file/range.
