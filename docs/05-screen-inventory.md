# Screen Inventory

For every screen below: Firestore collections and APIs are documented from route purpose, repository naming, Firestore rules, and shared library usage.

| File path | Purpose | Firestore collections used | APIs used | Permissions required |
|---|---|---|---|---|
| `frontend/app/_layout.tsx` | Root app shell, providers, auth/onboarding routing | users, app_settings, user_notification_settings | Firebase Auth, Firestore, Expo Router | Any; redirects by auth state |
| `frontend/app/(tabs)/_layout.tsx` | Authenticated tab navigation | users | Expo Router | approved verified users |
| `frontend/app/(tabs)/index.tsx` | Home dashboard and quick links | users, courses, notifications, status_updates, app_settings | Firestore | approved verified users |
| `frontend/app/(tabs)/courses.tsx` | Course catalogue | courses, enrollments, live_classes, modules, lessons | Firestore | approved verified users; course visibility/enrollment rules |
| `frontend/app/course/[id].tsx` | Course detail, lessons, live classes, enrollment state | courses, enrollments, modules, lessons, assignments, lesson_progress, live_classes | Firestore, /api/live-class/token via live screens | approved user with course access; teachers/admins see assigned content |
| `frontend/app/(tabs)/teachers.tsx` | Teacher directory | teachers, public_profiles, users | Firestore | approved verified users |
| `frontend/app/teacher/[id].tsx` | Teacher profile/detail | teachers, public_profiles, courses | Firestore | approved verified users |
| `frontend/app/(tabs)/library.tsx` | Library listing | library, audio_lessons, recordings | Firestore | approved verified users; content visibility |
| `frontend/app/book/[id].tsx` | Book/PDF detail | library | Firestore | approved verified users |
| `frontend/app/(tabs)/quiz.tsx` | Quiz hub | quizzes, quiz_results, lesson_progress | Firestore, /api/lms/quiz/submit | approved verified users |
| `frontend/app/(tabs)/progress.tsx` | Learning progress and certificate readiness | lesson_progress, quiz_results, certificates, enrollments | Firestore, /api/certificates/generate | owner, teacher/admin as allowed |
| `frontend/app/(tabs)/about.tsx` | About tab with platform/community information | app_settings | Firestore/static content | approved verified users |
| `frontend/app/(tabs)/attendance.tsx` | Attendance view/management | attendance, users, live_classes | Firestore | students self-read; teachers/admins manage |
| `frontend/app/(tabs)/certificate.tsx` | Certificate display | certificates, courses, users | Firestore, /api/certificates/generate | certificate owner or admin |
| `frontend/app/(tabs)/chats.tsx` | Chat list | chats, messages, users, public_profiles | Firestore | chat participants; broadcast visible to approved users |
| `frontend/app/chat/[id].tsx` | Chat conversation | chats, messages, message_reports, notifications | Firestore, push APIs indirectly | participants; admins for moderation |
| `frontend/app/(tabs)/notifications.tsx` | Notification tab | notifications, user_notification_settings | Firestore | targeted recipient/admin |
| `frontend/app/notifications.tsx` | Notification center route alias | notifications, user_notification_settings | Firestore | targeted recipient/admin |
| `frontend/app/status.tsx` | Status feed | status_updates, comments, reactions, views, status_reports | Firestore, /api/status/react | approved users; teachers/admins create |
| `frontend/app/status-player.tsx` | Status media viewer | status_updates, views, reactions | Firestore, media URLs | approved users |
| `frontend/app/recordings.tsx` | Class recordings library | recordings, live_classes/{id}/recordings | Firestore | eligible class users; teachers/admins |
| `frontend/app/live-class/[id].tsx` | Live class room | live_classes, participants, attendance_events, moderation_events, recordings | /api/live-class/token, /api/live-ops/event, /api/live-class/recording/start|stop, Agora SDK | eligible student/teacher/admin; teacher/admin for moderation/recording |
| `frontend/app/call/[id].tsx` | One-to-one/group call room | calls, calls/{id}/participants | /api/call/token, /api/call/cleanup, Agora SDK | call participants |
| `frontend/app/payment.tsx` | Payment submission/status | payments, app_settings, payment_gateway_events | /api/payments/initiate, /api/payments/confirm, /api/payments/webhook (server/provider) | approved verified users for own payments; admins review |
| `frontend/app/prayer-times.tsx` | Prayer times utility | none/local settings | Device location, external calculation/local utility | approved or public depending navigation |
| `frontend/app/qibla.tsx` | Qibla compass | none/local settings | Expo Location, sensors | approved or public depending navigation; location permission |
| `frontend/app/islamic-calendar.tsx` | Islamic calendar | none/local generated data | local calendar utilities | approved users |
| `frontend/app/islamic-dashboard.tsx` | Islamic dashboard widgets | users/local settings | local utilities | approved users |
| `frontend/app/more/_layout.tsx` | More section stack layout | none | Expo Router | approved users |
| `frontend/app/more/index.tsx` | More menu | users | Expo Router | approved users |
| `frontend/app/more/applications/index.tsx` | Applications menu | users | Expo Router | approved users |
| `frontend/app/more/applications/islamic-dashboard.tsx` | More-tab Islamic dashboard | users/local settings | local utilities | approved users |
| `frontend/app/more/attendance/index.tsx` | More-tab attendance shortcut | attendance | Firestore | same as attendance |
| `frontend/app/more/library/index.tsx` | More-tab library shortcut | library | Firestore | approved users |
| `frontend/app/more/quiz/index.tsx` | More-tab quiz shortcut | quizzes, quiz_results | Firestore, /api/lms/quiz/submit | approved users |
| `frontend/app/more/teachers/index.tsx` | More-tab teachers shortcut | teachers | Firestore | approved users |
| `frontend/app/settings.tsx` | User settings/profile/preferences | users, user_notification_settings, privacy_requests, legal_audit_events | Firebase Auth, Firestore | self; admins for admin-only actions |
| `frontend/app/onboarding-entry.tsx` | Onboarding router | users, compliance/legal_acceptance | Firebase Auth, Firestore | signed-in users |
| `frontend/app/onboarding-first-time/index.tsx` | First-run onboarding | users, compliance/legal_acceptance, public_profiles | Firebase Auth, Firestore | signed-in users |
| `frontend/app/onboarding-first-time/_layout.tsx` | Onboarding stack layout | none | Expo Router | signed-in users |
| `frontend/app/legal-gate.tsx` | Terms/privacy acceptance gate | users/{uid}/compliance, legal_audit_events | Firestore | signed-in users |
| `frontend/app/community-guidelines.tsx` | Community guidelines content | none | static | public/signed-in |
| `frontend/app/privacy.tsx` | Privacy policy | none | static | public/signed-in |
| `frontend/app/terms.tsx` | Terms of service | none | static | public/signed-in |
| `frontend/app/data-privacy.tsx` | Data privacy and request entry | privacy_requests, legal_audit_events | Firestore | signed-in/approved users |
| `frontend/app/unauthorized.tsx` | Unauthorized/pending access screen | users | Firebase Auth | signed-in users lacking approval/role |
| `frontend/app/auth/login.tsx` | Login | users | Firebase Auth, Firestore | public |
| `frontend/app/auth/signup.tsx` | Signup and profile creation | users, public_profiles | Firebase Auth, Firestore | public |
| `frontend/app/auth/forgot-password.tsx` | Password reset | none | Firebase Auth | public |
| `frontend/app/auth/change-email.tsx` | Email change workflow | users | Firebase Auth, Firestore | signed-in self |
| `frontend/app/auth/pending.tsx` | Pending approval screen | users | Firestore | signed-in pending/rejected users |
| `frontend/app/admin/users.tsx` | Admin user management | users, public_profiles, moderation_actions | Firestore, admin APIs if configured | admin/super_admin |
| `frontend/app/admin/manage-academics.tsx` | Academic content admin | courses, teachers, categories, modules, lessons, assignments, enrollments, quizzes | Firestore | admin/super_admin |
| `frontend/app/admin/add-book.tsx` | Library item creation | library | Firestore/storage URL | admin/super_admin |
| `frontend/app/admin/analytics.tsx` | Admin analytics dashboard | analytics_daily_summary, analytics_dashboards, analytics_alerts, worker_metrics | /api/analytics/ingest, /api/jobs/aggregate-analytics, Firestore | admin/super_admin |
| `frontend/app/admin/moderation.tsx` | Moderation queue/actions | moderation_reports, moderation_evidence, moderation_actions, moderation_logs, status_reports, message_reports | Firestore, /api/ai/infer optional | moderator/admin/super_admin |
| `frontend/app/admin/payments.tsx` | Payment review/reconciliation | payments, payment_audit_logs, payment_gateway_events, payment_verification_queue | /api/payments/admin/action, payment jobs | admin/super_admin |
| `frontend/app/admin/privacy-requests.tsx` | Privacy request review | privacy_requests, legal_audit_events | Firestore | admin/super_admin |
| `frontend/app/admin/security.tsx` | Security and audit review | security_events_immutable, moderation_actions, payment_processor_audit_logs | Firestore, /api/ops/health | admin/super_admin |
| `frontend/app/admin/send-push.tsx` | Manual push sender | notifications, notification_dispatch_queue, users | /api/push/send, /api/push/enqueue | admin/super_admin |
