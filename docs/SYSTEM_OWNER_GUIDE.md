# System Owner Guide

This guide is written for the next engineer who must own the full Madrasa project without access to the original developer. It explains how the product evolved, why the architecture looks the way it does, which data and flows are critical, and how to operate/recover production.

## 1. Project history and evolution

### Current product shape
Madrasa is an Expo SDK 54 React Native application with a FastAPI backend and Firebase/Firestore as the main application platform. The product has grown from a learning/community app into a broader operational platform that includes:

- Authenticated student, teacher, moderator, admin, and super-admin roles.
- Course, library, quiz, progress, attendance, recordings, and certificate features.
- Live classes and calls powered by Agora.
- In-app notifications and push delivery pipelines.
- Chat, status posts, reports, moderation actions, and community safety tooling.
- Payment submission, admin approval, webhook/audit logging, and reconciliation jobs.
- Analytics, reliability, offline, performance, media, security, and operations hardening work captured in the many phase/audit reports at the repository root.

### Evidence trail in the repository
The project has many historical reports that explain past hardening phases and production-readiness work. When taking ownership, read these in this order:

1. `README.md` and `frontend/README.md` for baseline project setup.
2. `docs/README.md` for the generated documentation suite.
3. `FIRESTORE_AUDIT_REPORT.md` and `FIRESTORE_PERMISSION_REPORT.md` for recent Firestore access history.
4. `PRODUCTION_AUDIT_2026-06-01.md`, `DEPLOYMENT_VALIDATION_REPORT.md`, and `COMPLETION_EVIDENCE.md` for production state.
5. Domain reports such as payment, security, performance, notification, media, offline sync, and observability phase reports for implementation rationale.

### Important ownership note
The codebase contains both implemented production paths and forward-looking/hardening modules. Do not assume every module is wired into the app UI. Verify a flow through:

1. route/screen under `frontend/app`,
2. shared module under `frontend/lib`,
3. Firestore rules in `firestore.rules`,
4. backend route/service under `backend`, and
5. test/report evidence.

## 2. Major architectural decisions and why they were made

| Decision | Current implementation | Why it was made | Ownership implications |
|---|---|---|---|
| Expo SDK 54 + Expo Router | `frontend/app` file-based routing | Speeds mobile development and supports native/web routing conventions. | Keep Expo package versions aligned through Expo-compatible upgrades only. |
| Firebase Auth for identity | frontend Firebase SDK; backend Firebase Admin token verification | Managed auth, email verification, mobile SDK support, and secure token verification. | Role changes live in Firestore, not Auth custom claims; rules read `users/{uid}.role`. |
| Firestore as primary app database | `firestore.rules`, frontend Firebase SDK, backend Admin SDK | Realtime listeners and security rules are central to chat, notifications, live state, and learning data. | Rule changes are production-critical and need emulator tests. |
| FastAPI backend for privileged operations | `backend/server.py` plus services/jobs | Secrets, payment validation, push routing, Agora token generation, and worker jobs cannot safely run on clients. | Split routes into domain routers over time; preserve auth/rate-limit/idempotency checks. |
| Agora for live media | backend token endpoints and React Native Agora dependency | Avoids building media infrastructure; supports RTC and cloud recording. | Certificates and recording credentials are high-risk secrets. Rotate if exposed. |
| Expo/FCM/APNS push abstraction | backend provider services and receipt ingestion | Allows push provider routing, token health, dedupe, and receipt tracking. | Keep token hygiene jobs running or push quality will degrade. |
| Firestore rules as client authorization truth | detailed `firestore.rules` validators and deny-by-default | Client apps can be modified; rules enforce role/owner constraints near the data. | Any new client collection needs explicit rules before release. |
| Audit-first security/payment/moderation | immutable security/payment/moderation collections | High-risk operations need traceability and incident response evidence. | Never make audit collections client-writable. |
| Manual/admin payment review support | payment state machine and admin screens | Supports Razorpay/manual bank/reference flows where automatic gateway confirmation may be incomplete. | State transitions and review evidence must stay consistent. |
| Server-owned async jobs | `/api/jobs/*`, queue collections, worker metrics | Long-running/retryable work needs leases, dedupe, and recovery. | Monitor dead letters, stale leases, and queue throughput. |

## 3. Firestore collections that are business-critical

These collections affect revenue, access, safety, or core learning operations. Treat schema/rule changes as high-risk.

### Identity and access
- `users`: source of role, approval status, profile, push tokens, and referral metadata.
- `users/{uid}/compliance`: legal acceptance state.
- `public_profiles`: searchable/profile mirror for community and teacher discovery.

### Learning and academic operations
- `courses`, `teachers`, `enrollments`: course access and teacher/class relationships.
- `categories`, `modules`, `lessons`, `assignments`: structured learning content.
- `lesson_progress`, `submissions`, `quiz_results`, `certificates`: student outcomes and completion.
- `library`, `audio_lessons`, `recordings`: learning resources and recorded materials.

### Live class and attendance
- `live_classes`: live session state and recording metadata.
- `live_classes/{classId}/participants`: presence/moderation state.
- `live_classes/{classId}/attendance_events`: join/leave audit events.
- `attendance`: durable attendance records.
- `calls`, `calls/{callId}/participants`: call sessions and participant state.

### Payments and entitlements
- `payments`: user payment lifecycle and entitlement source.
- `payment_gateway_events`: provider webhook/event audit.
- `payment_processor_audit_logs`, `payment_audit_logs`: admin/server transition audit.
- `payment_verification_queue`: async verification and recovery.

### Communication and safety
- `notifications`, `user_notification_settings`: in-app notification state.
- `notification_dispatch_queue`, `notification_provider_receipts`, `notification_token_registry`, `push_dedupe`: push delivery pipeline.
- `chats`, `messages`, `chat_messages`: chat state and message delivery.
- `status_updates`, `status_reports`, `message_reports`: social feed and abuse reports.
- `moderation_reports`, `moderation_evidence`, `moderation_actions`, `moderation_analytics_daily`: moderation workflow.
- `security_events_immutable`: security audit log.

### Operations and analytics
- `analytics_daily_summary`, `analytics_dashboards`, `analytics_alerts`: operational analytics.
- `async_jobs`, `dead_letter_jobs`, `worker_metrics`, `operation_dedupe`: async work and reliability.
- `provider_circuit_breakers`: notification provider routing safety.
- `app_settings`: platform settings, fees, social links, notices, and public content.
- `privacy_requests`, `legal_audit_events`: privacy/compliance operations.

## 4. Security-critical flows

### Authentication and approval
1. User authenticates with Firebase Auth.
2. User document is created in `users/{uid}` with `status: pending` and role `student` or `teacher`.
3. Email verification must be completed.
4. Admin approves or rejects the user.
5. Most Firestore reads/writes require signed-in, email-verified, approved state.

Risks:
- Accidentally allowing unapproved users to read business data.
- Allowing self-promotion to admin roles.
- Missing user docs causing role fallbacks.

### Role changes
Only admins/super-admins should change roles; super-admin-only operations should remain protected. User self-updates must not include role/status changes.

### Backend privileged endpoints
Sensitive endpoints include payment admin actions, payment webhook, push send/enqueue, Agora token issuance, recording start/stop, AI inference, worker jobs, and analytics aggregation.

Required controls:
- Firebase bearer token verification.
- Role/capability checks.
- Nonce/confirmation headers for high-risk actions where implemented.
- App Check where enabled.
- Idempotency keys for payment and queue actions.
- Rate limiting for abuse-prone endpoints.

### Client data rules
Firestore rules are deny-by-default. Do not add broad `allow read, write: if isSignedIn()` rules. Every new collection must define:

- allowed reader roles/owners,
- allowed writer roles/owners,
- allowed fields,
- immutable fields,
- valid state transitions, and
- delete behavior.

## 5. Payment approval lifecycle

### Payment states
The rules/backend recognize states such as:

- `pending`
- `submitted`
- `verified`
- `approved`
- `rejected`
- `processing`
- `succeeded`
- `failed`
- `cancelled`
- `refunded`
- `disputed`
- `expired`

The app often keeps `state` and `status` aligned.

### Standard lifecycle
1. **Create:** approved user creates a `payments/{paymentId}` record with amount, type, provider `razorpay`, currency `INR`, review mode, and `pending` state.
2. **Submit:** user adds `payment_ref` or `transaction_ref` and moves to `submitted`.
3. **Review:** admin uses payment review tooling/API to verify evidence.
4. **Approve/reject:** admin transitions to approved/succeeded or rejected/failed and writes review metadata.
5. **Audit:** backend/admin action writes payment audit records.
6. **Entitlement:** approved/succeeded payments may grant access/entitlement flags.
7. **Reconciliation:** jobs recover stale `processing` payments and expire old pending records.

### Do not break
- Owner-only create/submit behavior.
- Admin-only review fields.
- Gateway event immutability.
- Idempotency for webhook/admin transitions.
- Audit log creation for every privileged transition.

## 6. User role lifecycle

### Roles
- `student`: default learner role.
- `teacher`: can teach/participate in teacher flows.
- `assistant_teacher`: helper teacher role; should be scoped carefully.
- `moderator`: community safety role.
- `admin`: operational admin role.
- `super_admin`: highest role and role assignment authority.

### Lifecycle
1. User signs up as student/teacher.
2. User document starts `pending`.
3. Admin reviews and sets `status` to `approved` or `rejected`.
4. Admin may update role within allowed boundaries.
5. Super admin should handle admin/super-admin promotions.
6. Users may be `deactivated` if access should be removed without deleting history.

### Operational guidance
- Prefer deactivation over deletion when audit history matters.
- Never let users change their own role/status.
- When changing a role, verify UI access, Firestore rules, backend checks, and any cached local state.

## 7. Notification lifecycle

### In-app notification flow
1. Admin/teacher/system creates `notifications/{notificationId}`.
2. Notification targets one user, all users, target roles, or target user IDs.
3. Client reads notifications if rules allow broadcast/own/role-targeted access.
4. Client updates read/hidden metadata for itself.

### Push notification flow
1. Client registers Expo/FCM token and stores it on `users/{uid}`.
2. Push send/enqueue endpoint receives a payload and target set.
3. Backend collects tokens, deduplicates, routes to provider adapter, and stores receipts.
4. Receipt polling jobs update provider/token health.
5. Aggregation jobs produce notification health metrics.

### Failure modes
- Expired/invalid tokens reduce delivery.
- Queue leases can become stale.
- Provider outage may require circuit breaker/fallback routing.
- Bad targeting can leak notifications to unintended roles if rules/payloads are wrong.

## 8. Chat lifecycle

### Chat creation
- Direct chats: signed-in approved user creates with exactly two participants.
- Groups/broadcasts: admin-created.

### Message lifecycle
1. Participant creates a message with `chat_id`, text/media fields, sender fields, and read metadata.
2. Client updates delivery/seen/read metadata.
3. Sender can unsend using the constrained unsend fields.
4. User can hide/delete-for-self via allowed metadata.
5. Abuse reports create `message_reports` for moderator/admin review.

### Backward compatibility
Both `messages` and `chat_messages` exist. This is technical debt. Before removing either collection:

1. verify all released clients use one collection,
2. migrate data or create compatibility readers,
3. update rules/tests, and
4. update moderation/reporting paths.

## 9. Live class lifecycle

### Class lifecycle
1. Teacher/admin creates `live_classes/{classId}` with status `live` and class metadata.
2. Student/teacher loads class if eligible by enrollment/course/role.
3. Client requests `/api/live-class/token`.
4. Backend validates Firebase auth, role/enrollment/class status, and issues an Agora token.
5. Client joins Agora channel and writes participant/attendance events.
6. Teacher/admin can moderate participants and start/stop recordings.
7. Recording metadata is written under live class and/or top-level `recordings`.
8. Class is ended/cleaned up by teacher/admin or maintenance jobs.

### Critical dependencies
- `AGORA_APP_ID`
- `AGORA_APP_CERTIFICATE`
- `AGORA_RTC_TOKEN_TTL_SECONDS`
- Agora cloud recording customer credentials
- Recording storage bucket credentials
- Firestore live class rules

### Debug checklist
- Verify user is approved and enrolled/authorized.
- Verify class status is joinable.
- Verify backend can initialize Firebase Admin.
- Verify Agora app ID/certificate are correct.
- Verify token TTL and device clock skew.
- Verify Firestore writes to participants/attendance are allowed.

## 10. Deployment checklist

### Frontend
- [ ] Confirm `frontend/package-lock.json` is valid with `npm ci`.
- [ ] Confirm Expo SDK package versions are compatible.
- [ ] Create production `.env` from `frontend/.env.example`.
- [ ] Set `EXPO_PUBLIC_APP_ENV=production`.
- [ ] Set backend, live, push, Firebase project, and Agora public config.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm test` where practical.
- [ ] Run `npx expo-doctor`.
- [ ] Run release readiness checks if available.
- [ ] Build with EAS profile from `frontend/eas.json`.

### Backend
- [ ] Create backend environment from `backend/.env.example`.
- [ ] Configure Firebase service account.
- [ ] Configure CORS allowlist.
- [ ] Configure Agora credentials.
- [ ] Configure payment provider secrets/webhooks.
- [ ] Install Python dependencies from `backend/requirements.txt`.
- [ ] Run `pytest backend`.
- [ ] Confirm `/health` and `/api/ops/health`.
- [ ] Confirm worker/job endpoint protection.

### Firebase
- [ ] Deploy `firestore.rules`.
- [ ] Deploy `firestore.indexes.json`.
- [ ] Configure Auth providers/email verification.
- [ ] Confirm service account access.
- [ ] Configure App Check if production requires it.

## 11. Release checklist

### Before release
- [ ] No uncommitted changes.
- [ ] CI green.
- [ ] Firestore rules tests/emulator checks pass.
- [ ] Backend tests pass.
- [ ] Manual smoke test on staging.
- [ ] Admin approval flow tested.
- [ ] Payment submission and admin review tested.
- [ ] Live class token and join tested.
- [ ] Push token registration and test notification verified.
- [ ] Chat send/read/report tested.
- [ ] Privacy/legal gate tested.
- [ ] Rollback plan identified.

### After release
- [ ] Monitor backend health endpoints.
- [ ] Monitor Firebase usage/errors.
- [ ] Monitor payment webhook/admin queue.
- [ ] Monitor push receipt failures.
- [ ] Monitor live class join errors.
- [ ] Monitor security and moderation logs.
- [ ] Confirm no unexpected Firestore permission-denied spike.

## 12. Disaster recovery procedures

### Severity levels
- **SEV-1:** app unavailable, auth broken, payment data corruption, rules expose private data, backend cannot serve critical endpoints.
- **SEV-2:** live classes down, push pipeline down, payment review stalled, admin tools unavailable.
- **SEV-3:** isolated feature regression, analytics outage, non-critical UI issue.

### Immediate steps
1. Declare incident and assign incident commander.
2. Freeze deployments except hotfix/rollback.
3. Capture current commit, environment, Firebase rules version, and backend logs.
4. Determine blast radius: auth, Firestore, backend, payments, Agora, push, or app build.
5. Roll back the most recent risky deployment if the cause is unclear and rollback is safe.
6. Preserve evidence: logs, failed payloads, audit docs, provider dashboard screenshots.
7. Communicate status to stakeholders/users if user-visible.

### Recovery by subsystem
- **Firestore rules outage:** redeploy previous known-good `firestore.rules`; run emulator tests before applying a new fix.
- **Backend outage:** roll back Railway/service deployment; verify env vars and Firebase Admin initialization.
- **Payment issue:** pause admin approvals if integrity is uncertain; export payment/audit/gateway records before repair.
- **Push issue:** disable manual/bulk push if targeting is wrong; inspect queue and receipts before retrying.
- **Live class outage:** verify Agora dashboard, credentials, token endpoint, and class status; provide alternate class link if needed.
- **Data leak:** revoke exposed credentials, tighten rules, export access logs, notify according to legal requirements.

## 13. Backup and restore procedures

### Firestore backup
Recommended production approach:

1. Enable scheduled Firestore exports to a Google Cloud Storage bucket.
2. Use a bucket with versioning, retention policy, and restricted IAM.
3. Store export logs and verify backup completion.
4. Test restore into a staging Firebase project at least quarterly.

Example commands:

```bash
gcloud firestore export gs://YOUR_BACKUP_BUCKET/firestore/$(date +%Y-%m-%d)
gcloud firestore import gs://YOUR_BACKUP_BUCKET/firestore/YYYY-MM-DD
```

### MongoDB backup
If legacy MongoDB status endpoints are still required:

```bash
mongodump --uri "$MONGO_URL" --out ./backups/mongo-$(date +%Y-%m-%d)
mongorestore --uri "$MONGO_URL" ./backups/mongo-YYYY-MM-DD
```

### Backend configuration backup
- Export environment variable names and non-secret structure.
- Store actual secrets only in an approved secret manager.
- Keep service account key rotation records.

### Restore validation
After restore:

1. Verify users and roles.
2. Verify a sample payment and audit trail.
3. Verify a course/enrollment/progress chain.
4. Verify chat/message read rules.
5. Verify live class token issuance in staging.
6. Verify push token registration does not write stale/invalid tokens.

## 14. Firebase setup from scratch

1. Create a Firebase project.
2. Enable Firebase Authentication.
3. Configure email/password provider and email verification templates.
4. Create Firestore database in production mode.
5. Deploy `firestore.rules`.
6. Deploy `firestore.indexes.json`.
7. Create service account for backend Firebase Admin.
8. Store service account JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` or configure `GOOGLE_APPLICATION_CREDENTIALS`.
9. Configure App Check if required by production policy.
10. Add web/mobile app configs and map required values to frontend env variables.
11. Create first super-admin safely:
    - create the Firebase Auth user,
    - create `users/{uid}` with approved status and `super_admin` role using trusted Admin SDK or console,
    - verify Firestore rules block self-promotion.
12. Seed required `app_settings/platform` fields for fees/social links/notices.
13. Smoke test signup, approval, login, rules, and backend Firebase token verification.

## 15. Agora setup from scratch

1. Create an Agora account and project.
2. Obtain `AGORA_APP_ID`.
3. Enable App Certificate and store `AGORA_APP_CERTIFICATE` securely.
4. Configure token authentication in backend environment.
5. Set `AGORA_RTC_TOKEN_TTL_SECONDS` to a reasonable production value.
6. For cloud recording:
   - enable cloud recording,
   - create customer ID/secret,
   - configure recording vendor/region,
   - create storage bucket and credentials,
   - set `AGORA_RECORDING_*` env vars.
7. Confirm backend `/api/live-class/token` returns valid tokens.
8. Test a staging live class with two devices.
9. Test start/stop recording and confirm metadata and storage output.
10. Document credential rotation procedure.

## 16. Environment recreation guide

### Local frontend
```bash
cd frontend
cp .env.example .env
npm ci
npx tsc --noEmit
npm start
```

If `npm ci` fails in a proxy/restricted environment, verify registry/proxy config first. Do not commit lockfile edits generated by a broken registry configuration.

### Local backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --reload
```

### Full staging recreation
1. Create a staging Firebase project.
2. Deploy rules/indexes.
3. Create staging backend service with staging env vars.
4. Create staging Expo env values pointing to staging backend/Firebase.
5. Seed admin user, app settings, sample courses, teacher, student, enrollment, and test payment.
6. Run smoke tests for auth, rules, backend, live class, push, payment, chat, and analytics.

## 17. Production incident response guide

### First 15 minutes
1. Acknowledge incident and assign owner.
2. Capture impact, start time, symptoms, and affected users.
3. Check recent deployments and config changes.
4. Check Firebase status, backend logs, Agora status, payment provider status, and Expo/push provider status.
5. Decide whether to roll back.

### Investigation commands and checks
- `git log --oneline -10`
- `git diff <last-good>..<current>`
- backend `/health`
- backend `/api/ops/health`
- Firebase Firestore usage/errors dashboard
- Firebase Auth sign-in/error dashboard
- payment provider webhook logs
- Agora project usage/error dashboard
- push provider receipts and queue metrics

### Communication
- Use a single incident channel.
- Post updates on a fixed cadence.
- Separate user-facing facts from internal hypotheses.
- After resolution, write a postmortem with root cause, timeline, impact, remediation, and owners.

## 18. Common debugging commands

### Git and repository
```bash
git status --short
git log --oneline -20
git diff --stat
git diff -- firestore.rules backend/server.py frontend/package.json frontend/package-lock.json
```

### Frontend
```bash
cd frontend
node -v
npm -v
npm ci
npm ls semver
npm ls --all semver
npx tsc --noEmit
npm test
npx expo-doctor
npm run release:check
```

### Backend
```bash
cd backend
python --version
pip install -r requirements.txt
pytest backend
uvicorn server:app --reload
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/
```

### Firebase
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase emulators:start --only firestore,auth
firebase firestore:indexes
```

### Search/code inspection
```bash
rg -n "collection\(|doc\(|onSnapshot|getDocs|addDoc|setDoc|updateDoc" frontend backend
rg -n "@api_router\.|@app\." backend/server.py
rg -n "match /|allow " firestore.rules
rg -n "TODO|FIXME|HACK|permission-denied|payment|Agora|notification" .
```

## 19. Most likely future failure points

1. **Firestore rule regressions:** new UI writes fields not whitelisted by rules.
2. **Lockfile drift:** `package.json` and `package-lock.json` mismatch causing `npm ci` failures.
3. **Expo SDK drift:** packages upgraded outside Expo compatibility ranges.
4. **Role ambiguity:** moderator/teacher/admin helper overlap causing unintended access.
5. **Payment state drift:** backend/admin UI/rules disagree on allowed transitions.
6. **Webhook idempotency bugs:** duplicate provider events double-process payments.
7. **Push token decay:** invalid tokens accumulate if receipt jobs are not run.
8. **Notification queue leases:** stale leases or dead-letter growth block delivery.
9. **Agora credentials/token TTL:** expired/misconfigured credentials break live joins.
10. **Recording storage config:** Agora recording succeeds but storage output fails.
11. **Chat collection duplication:** `messages` and `chat_messages` diverge.
12. **Backend monolith growth:** `backend/server.py` becomes harder to safely change.
13. **Unseeded app settings:** payments/about/notices fail or show blanks in new environments.
14. **Missing indexes:** Firestore queries fail only after deployment with real data.
15. **Proxy/registry differences:** local and CI dependency resolution behave differently.

## 20. Recommended roadmap for the next developer

### First week
1. Reproduce local frontend/backend setup.
2. Read all docs in `docs/` and the root audit reports.
3. Run frontend, backend, and Firestore rule checks.
4. Create a staging Firebase project and verify full environment recreation.
5. Trace one end-to-end flow each for auth, payment, live class, chat, notification, and quiz.

### First month
1. Add/expand Firestore emulator tests for every critical collection.
2. Split `backend/server.py` into domain routers.
3. Create typed Firestore schemas shared by frontend docs/tests.
4. Add OpenAPI examples for all backend endpoints.
5. Build an operational dashboard for queues, payment reconciliation, push receipts, and security events.
6. Resolve chat `messages` vs `chat_messages` duplication.
7. Clarify moderator vs teacher helper permissions in rules and UI.

### Next quarter
1. Automate Firestore backups and restore drills.
2. Add disaster recovery runbooks per subsystem.
3. Add payment provider sandbox integration tests.
4. Add live class synthetic monitoring.
5. Improve offline learning and chat retry flows.
6. Add privacy export/delete automation.
7. Establish dependency update cadence tied to Expo SDK releases.
8. Create user/admin training docs and release notes from this documentation suite.
