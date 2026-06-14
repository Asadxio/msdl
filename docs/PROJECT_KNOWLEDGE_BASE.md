# Project Knowledge Base

This document captures project knowledge that is not obvious from reading the code alone. It explains not only **what** exists, but **why** it exists, where the project has historically failed, and which assumptions a new maintainer must preserve.

## 1. Why the project exists

Madrasa exists to provide a mobile-first Islamic learning and community platform for students, teachers, and administrators. It combines academic content, live classes, Islamic utilities, community communication, payments, attendance, certificates, and moderation into one app because the target operating model needs more than a static LMS.

The project is designed around these real-world needs:

- students need a simple app for learning, live sessions, payments, and reminders;
- teachers need controlled tools for live teaching, resources, attendance, and communication;
- admins need approval, payment review, moderation, privacy, security, and operational controls;
- the platform needs auditability because roles, payments, and community safety decisions can affect trust;
- the app must work in a mobile-first environment where push, live media, and realtime state matter.

The app is therefore not just a course catalog. It is a managed learning community with operational workflows.

## 2. Original goals

The original goals appear to have evolved through multiple hardening phases, but the durable product goals are:

1. **Centralize learning:** courses, library content, quizzes, audio lessons, recordings, assignments, and certificates should live in one app.
2. **Support live teaching:** teachers should be able to run live classes and preserve attendance/recording metadata.
3. **Control access:** students should not access protected content until authenticated, verified, and approved.
4. **Enable admin-managed operations:** user approval, academic content, payments, moderation, privacy, and security should be manageable without direct database edits.
5. **Preserve trust:** payment decisions, role changes, moderation actions, and security events should be auditable.
6. **Avoid exposing secrets to clients:** Agora certificates, provider credentials, privileged Firebase Admin operations, and payment validation belong on the backend.
7. **Use Firebase for realtime mobile behavior:** Firestore and Firebase Auth provide fast iteration and realtime state for mobile clients.

## 3. Business rules

### Identity and approval
- Users can sign up as `student` or `teacher`, but access should remain limited until email verification and admin approval.
- Admin/super-admin roles must not be self-assigned.
- Deactivation is preferred over deletion when history matters.
- The Firestore `users/{uid}` document is the business source of role/status truth.

### Learning
- Course access should be governed by role, approval status, and enrollment/content visibility.
- Progress, quiz results, submissions, attendance, and certificates are user-outcome records and must not be casually edited.
- Admins own academic content management; teachers may have scoped/assigned responsibilities where implemented.

### Payments
- Users create and submit their own payments.
- Admins review/approve/reject payment evidence.
- Payment state transitions require auditability and idempotency.
- Gateway events and processor audit logs are server-owned and should never be client-writable.

### Communication and safety
- Chat participants can read/write only within their chat.
- Broadcast/group behavior should remain admin-controlled.
- Users can report messages/statuses; moderators/admins review.
- Moderators should not be able to act against admin/super-admin targets.

### Live classes
- Live class tokens must be issued by the backend after membership/role checks.
- Agora app certificates and recording credentials must never be shipped to the frontend.
- Attendance events should be append-only or tightly constrained because they become operational evidence.

## 4. User expectations

### Students expect
- Login/signup and approval state to be clear.
- Courses, live classes, library, quizzes, and certificates to be easy to find.
- Payment submissions to be acknowledged and reviewed.
- Notifications to be relevant and not leak private/admin content.
- Chat/status interactions to be safe and reportable.

### Teachers expect
- Class and communication tools to work during scheduled sessions.
- Attendance and live class access to be reliable.
- Student communications and reports to be manageable.

### Admins expect
- User approval/role updates to be safe.
- Payment evidence and review actions to be auditable.
- Push notifications to target the intended audience.
- Moderation/security/privacy screens to show enough context to act.

### Maintainers expect
- `npm ci` should reproduce frontend installs.
- Firestore rules should match app writes.
- Backend environment variables should recreate production/staging reliably.
- Docs should explain why sensitive constraints exist.

## 5. Historical bugs and lessons learned

The repository contains many audit and phase reports, which indicates the project has repeatedly found and hardened production risks. Important lessons:

1. **Firestore permissions are easy to break.** Client code and rule field whitelists must evolve together.
2. **Lockfiles matter.** A small nested dependency mismatch blocked `npm ci`; CI install reproducibility is a release blocker.
3. **Role logic must be explicit.** Helper functions such as teacher/admin/moderator groupings can accidentally grant broader access than intended.
4. **Payment transitions require a state machine.** Free-form admin edits can corrupt revenue/entitlement state.
5. **Push delivery needs maintenance jobs.** Token health and provider receipt handling are not optional at scale.
6. **Live class reliability depends on backend, Firestore, and Agora all aligning.** A valid UI is not enough if tokens, rules, or provider credentials fail.
7. **Docs are part of the system.** Much operational behavior is distributed across rules, backend services, frontend screens, and historical reports.

## 6. Firestore permission incidents

Firestore has been a recurring risk area. The likely historical pattern:

- frontend writes added fields that were not allowed by `firestore.rules`;
- admin/user screens expected list access that rules denied;
- sensitive collections needed to be server-owned but client code attempted direct access;
- role helper behavior did not perfectly match product expectations;
- newly introduced collections were blocked by the default deny rule.

### Lessons
- Treat `firestore.rules` as production code, not configuration.
- Any new client write requires a rule update and emulator test.
- Any new collection must explicitly define read/write permissions.
- Avoid broad signed-in access; prefer owner/role/field validation.
- Keep a list of server-owned collections that frontend must not write.

### Collections most likely to trigger permission bugs
- `users`
- `payments`
- `notifications`
- `chats`, `messages`, `chat_messages`
- `status_updates` subcollections
- `live_classes` subcollections
- `lesson_progress`, `quiz_results`, `submissions`
- moderation and audit collections

## 7. Payment approval incidents

Payment features are high-risk because they affect trust and entitlement. Historical hardening suggests prior risks around:

- stale `pending` or `processing` payments;
- admin actions without enough audit metadata;
- webhook/provider events needing idempotency;
- mismatch between `state` and `status` fields;
- manual review evidence needing consistent validation;
- users editing fields that should be admin/server-owned.

### Lessons
- Never skip audit logs for payment transitions.
- Preserve owner-only create/submit and admin-only review fields.
- Treat duplicate webhooks as normal; design idempotently.
- Reconciliation jobs are part of the payment system, not optional cleanup.
- Payment UI, backend validators, and Firestore rules must agree on allowed states.

## 8. Notification permission incidents

Notification permissions are subtle because there are two channels: in-app Firestore notifications and provider push notifications.

Likely historical incident classes:

- role-targeted notifications visible to the wrong users;
- users unable to mark notifications read/hidden because rules were too strict;
- teachers needing limited class-related sends while broad sends remain admin-only;
- push tokens becoming stale and reducing delivery quality;
- queued notifications needing provider receipt tracking and dedupe.

### Lessons
- Keep notification payloads minimal and non-sensitive when sent through push providers.
- Verify both Firestore notification read rules and backend targeting logic.
- Ensure `hidden_by` and `read` updates cannot modify notification content.
- Run token health and receipt polling jobs.
- Use dedupe IDs for queued or retried sends.

## 9. Chat architecture decisions

### Why chat uses Firestore
Chat needs realtime updates, participant filtering, read receipts, and message status changes. Firestore is a natural fit because mobile clients can subscribe to chat/message changes directly while rules enforce participant access.

### Why top-level messages exist
Messages appear as top-level `messages` documents linked by `chat_id`, with `chat_messages` retained as a backward-compatible alias. This likely exists because earlier app versions or experiments used different collection names.

### Important decisions
- Direct chats require exactly two participants.
- Group and broadcast chats are admin-controlled.
- Broadcast chats are readable by approved users but write-restricted.
- Message deletion is metadata-based rather than hard delete.
- Abuse reports are separate records, preserving message/report auditability.

### Ownership warning
The duplicate `messages` / `chat_messages` pattern is technical debt. Do not remove one without confirming all released clients, rules, reports, and moderation screens have migrated.

## 10. Live class architecture decisions

### Why Agora is used
Agora provides RTC and cloud recording without the project owning media infrastructure. This reduces implementation cost but introduces credential, token, provider-status, and recording-storage dependencies.

### Why tokens come from backend
The Agora app certificate is secret. Clients request tokens from the backend so the backend can:

- verify Firebase identity;
- verify class membership/enrollment/role;
- enforce joinability/status;
- set token expiry;
- record token issue metadata;
- avoid shipping privileged secrets.

### Why Firestore still matters
Agora carries media, but Firestore carries business state:

- class metadata;
- participant presence;
- attendance events;
- moderation events;
- recording metadata.

Live class failures often require checking both Agora and Firestore.

## 11. Features that were considered but rejected

These are inferred from the architecture and current constraints:

- **Client-side Agora token generation:** rejected because it would expose certificates.
- **Unauthenticated public course access:** rejected because approval/enrollment and community safety matter.
- **Client-writable audit logs:** rejected because logs would be forgeable.
- **Free-form payment edits:** rejected in favor of validated transitions and audit trails.
- **Single global push send without queue/receipts:** rejected because delivery reliability and provider errors need tracking.
- **Hard-deleting chat messages by users:** rejected in favor of unsend/delete-for-self metadata.
- **Broad `isSignedIn()` Firestore access:** rejected because role/status/owner constraints are required.
- **Only automatic payment approval:** manual review remains because provider/reference evidence may need admin verification.

If a future developer wants to reintroduce one of these ideas, first document the risk model and update rules/tests/backend validation.

## 12. Temporary workarounds still in production

Likely/known workarounds that should be treated carefully:

1. **`messages` and `chat_messages` dual support:** exists for compatibility and should be consolidated only after migration.
2. **`state` and `status` both on payments:** supports UI/backward compatibility but risks drift.
3. **Manual payment review mode:** operationally necessary but requires disciplined audits.
4. **Moderator included in some teacher/admin helper checks:** may be intentional for operations but should be product-reviewed.
5. **Legacy MongoDB status endpoints:** backend still includes Mongo status checks, even though Firestore is primary app storage.
6. **Root-level phase reports as knowledge store:** historical rationale is not fully encoded in code comments.
7. **Proxy-sensitive dependency installs:** local environments may fail even when CI works; avoid lockfile edits from broken registries.

## 13. Dangerous files and critical systems

### Dangerous files
- `firestore.rules`: can expose or block production data instantly.
- `firestore.indexes.json`: missing indexes can break production queries.
- `backend/server.py`: central privileged API surface.
- `backend/payments/*`, `backend/security/*`, `backend/services/*`: payment, security, queue, and notification behavior.
- `frontend/lib/firebase.ts`: Firebase client initialization.
- `frontend/lib/rbac.ts`, `frontend/lib/roles.ts`: client-side role assumptions.
- `frontend/lib/pushNotifications.ts`, `frontend/lib/notifications.ts`: notification behavior.
- `frontend/lib/liveClasses.ts`, `frontend/lib/calls.ts`: live media behavior.
- `frontend/package.json` and `frontend/package-lock.json`: CI install reproducibility.
- `backend/requirements.txt`: backend reproducibility/security.
- `.github/workflows/ci.yml`: release gate behavior.

### Critical systems
- Firebase Auth and Firestore rules.
- Backend Firebase Admin initialization.
- Payment review/webhook/reconciliation.
- Agora token/recording endpoints.
- Notification queue/provider receipt jobs.
- User role/status approval flow.
- Security/moderation audit logs.

## 14. Files that should never be modified without review

Require at least one senior/owner review before changing:

- `firestore.rules`
- `backend/server.py`
- `backend/payments/payment_state.py`
- `backend/payments/payment_finalizer.py`
- `backend/payments/webhook_verifier.py`
- `backend/security/paymentSecurity.py`
- `backend/security/security_engine.py`
- `backend/validators/payment_validator.py`
- `backend/validators/role_validator.py`
- `frontend/lib/firebase.ts`
- `frontend/lib/rbac.ts`
- `frontend/lib/roles.ts`
- `frontend/lib/pushNotifications.ts`
- `frontend/lib/liveClasses.ts`
- `frontend/lib/calls.ts`
- `frontend/package.json`
- `frontend/package-lock.json`
- `.github/workflows/ci.yml`
- `firebase.json`
- `firestore.indexes.json`
- any production environment or secret configuration

## 15. Release blockers discovered historically

Known or likely blockers from project history:

1. `npm ci` failing due package-lock/package.json mismatch or nested dependency mismatch.
2. TypeScript failures after dependency reinstall.
3. Firestore permission-denied errors after adding fields/features.
4. Missing Firestore indexes for real production queries.
5. Backend failing Firebase Admin initialization due malformed service account env.
6. CORS blocking production frontend/mobile origins.
7. Agora token generation failing from missing app certificate.
8. Payment webhooks failing signature verification or idempotency.
9. Push notification sends failing due invalid/stale tokens.
10. App settings missing required platform fields.
11. Admin user not seeded in a new environment.
12. Expo package versions drifting outside SDK compatibility.

## 16. Performance bottlenecks

### Firestore query bottlenecks
- Large chat/message/status collections can become expensive without pagination and indexes.
- Admin screens listing users/payments/moderation queues need pagination.
- Role-targeted notifications can become expensive if targeting is not indexed or fanout is naive.

### Realtime bottlenecks
- Too many live listeners on chat/status/notifications can drain device resources.
- Presence and participant count updates in live classes can create write hotspots.

### Backend bottlenecks
- Notification fanout can overwhelm provider APIs without batching, queues, dedupe, and circuit breakers.
- Payment reconciliation jobs must avoid scanning too much data each run.
- Analytics aggregation should use date partitions and incremental processing.

### Mobile bottlenecks
- Media-heavy status/library/recordings screens require thumbnailing, caching, and lazy loading.
- Offline sync and cache layers can grow if cleanup jobs are not maintained.

## 17. Security assumptions

The system assumes:

- Firebase ID tokens cannot be forged and are verified server-side for privileged APIs.
- Email verification and `users/{uid}.status == approved` are required for most app access.
- Firestore rules are deployed exactly from this repository and not hot-edited in console without commit history.
- `users/{uid}.role` is the authoritative role source.
- Backend service account credentials are secret and only available to backend runtime.
- Agora certificates and recording credentials are secret and never exposed to the client.
- Payment provider secrets/signatures are secret and webhook handlers verify them.
- Audit collections are append-only/server-owned or tightly admin-controlled.
- Clients are untrusted; UI checks only improve UX and must not be relied on for security.

If any assumption becomes false, treat it as a security incident.

## 18. Technical debt register

| Debt | Why it exists | Risk | Recommended fix |
|---|---|---|---|
| `messages` and `chat_messages` both supported | Backward compatibility | Data divergence and duplicated rules | Migrate clients to one collection, then remove alias. |
| Payment `state` and `status` duplication | Backward/UI compatibility | Drift or inconsistent state checks | Create canonical state model and migration. |
| Large `backend/server.py` | Fast iteration and centralized routing | Harder reviews and accidental regressions | Split into domain routers. |
| Historical knowledge in reports | Phase-based development | New owners miss context | Keep docs updated and link reports from docs. |
| Firestore schemas not generated | Firebase-first development | Runtime permission/type bugs | Add shared schema/type generation. |
| Limited emulator test coverage | Rules evolved quickly | Permission regressions | Add tests for every critical collection. |
| Moderator role overlap | Operational convenience | Over-permission risk | Product/security review and rule refactor. |
| Manual payment review | Business need | Human error/slow processing | Improve admin evidence UI and reconciliation automation. |
| Push provider complexity | Reliability hardening | Worker/queue operational burden | Add queue dashboards and alerts. |
| Local proxy-sensitive installs | Environment limitation | Bad lockfile changes | Document registry/proxy setup and use CI as authority. |

## 19. Frequently asked developer questions

### Why are roles in Firestore instead of Auth custom claims?
Firestore roles are easier for admin UI updates and rules lookups. The tradeoff is that every security-sensitive role change must be protected by rules/backend validation and missing user docs must be handled carefully.

### Why does almost everything require approval?
The app is a managed learning community. Approval reduces spam, protects class/community spaces, and lets admins control student/teacher access.

### Why not let the frontend call Agora directly?
Agora token generation requires a secret certificate. The backend must issue tokens after validating Firebase identity and class access.

### Why are payment gateway/audit collections not client-writable?
Because payment evidence and audit history must be trustworthy. Client-writable audit records can be forged.

### Why do Firestore writes fail after adding a field?
Rules use strict field whitelists. Add the field to rules, validate type/immutability, and add tests before relying on it.

### Why are there so many notification backend services?
Push delivery at scale requires token collection, dedupe, queueing, provider routing, receipts, token health, circuit breakers, and metrics.

### Why are there root-level phase reports?
The project appears to have been hardened iteratively. Those reports preserve reasoning that may not be obvious in code.

### Should I edit docs when changing behavior?
Yes. Update docs when changing Firestore collections, backend APIs, roles, payment states, notification targeting, live class behavior, deployment, or incident response procedures.

## 20. Onboarding guide for a new developer

### Day 1: understand the system
1. Read `docs/README.md`.
2. Read `docs/SYSTEM_OWNER_GUIDE.md`.
3. Read this knowledge base.
4. Skim `firestore.rules`, `backend/server.py`, and `frontend/app` route structure.
5. Review root audit reports for historical context.

### Day 2: run locally
1. Set up frontend `.env` from `frontend/.env.example`.
2. Run `cd frontend && npm ci`.
3. Run `npx tsc --noEmit` and `npm test` if dependencies install correctly.
4. Set up backend `.env` from `backend/.env.example`.
5. Run backend tests and start FastAPI locally.

### Day 3: trace critical flows
Trace these end to end in code, rules, backend, and docs:

- signup → email verification → admin approval → app access;
- payment create → submit → admin review → audit/reconciliation;
- notification create/enqueue → push receipt → in-app read state;
- chat create → message send → read/seen → report;
- live class create → token → join → attendance → recording;
- quiz submit → result → progress/certificate.

### First week deliverables
- Confirm local or staging environment works.
- Identify any docs that are stale.
- Run or add at least one Firestore emulator test for a critical rule.
- Verify CI install behavior with `npm ci`.
- Review open technical debt and choose one low-risk cleanup.

### First month deliverables
- Improve automated Firestore rules coverage.
- Add OpenAPI examples or split one backend domain router.
- Add operational alerts for one critical queue/payment/push metric.
- Document any production-only setup discovered during onboarding.
