# Complete App Flow

## 1. First launch and authentication
1. User opens the app and root layout initializes providers, Firebase, auth, onboarding, and navigation guards.
2. Unauthenticated users go to login/signup/forgot-password.
3. Signup creates Firebase Auth identity plus a pending Firestore `users/{uid}` profile and public profile mirror.
4. User verifies email and accepts legal terms through onboarding/legal gate.
5. Pending users remain on pending/unauthorized screens until an admin approves the profile.

## 2. Approved learner journey
1. Student lands on home/dashboard.
2. Student browses courses, teachers, library, quizzes, notifications, chats, and status feed.
3. Student opens a course, views lessons/modules/assignments/audio lessons, joins eligible live classes, and records lesson progress.
4. Student submits quizzes through backend validation and receives quiz results.
5. Student tracks attendance/progress and requests or views certificates when eligible.
6. Student submits payments and tracks review/approval.

## 3. Teacher journey
1. Teacher views assigned courses and teacher-facing live class tools.
2. Teacher starts live class, receives backend Agora token, and may moderate participants.
3. Teacher/admin attendance can be recorded manually or from live join/leave events.
4. Teacher may send allowed notifications and participate in chats/status posts.

## 4. Admin/moderator journey
1. Admin dashboard routes expose users, academics, library, analytics, moderation, payments, privacy, security, and push.
2. Moderator reviews reports/evidence/actions but cannot action admin/super-admin targets.
3. Admin reviews payment submissions, resolves privacy requests, runs operational jobs, and monitors health.

## 5. Backend/worker flow
1. Clients call authenticated API endpoints with Firebase bearer tokens.
2. Backend validates Firebase Auth, role, nonce/rate limits, and App Check where enabled.
3. Backend writes server-owned records, emits audit logs, queues async jobs, and sends provider requests.
4. Worker endpoints process push receipts, notifications, analytics, payments, storage cleanup, and stale leases.
