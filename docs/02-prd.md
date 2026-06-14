# Product Requirements Document (PRD)

## Goals
1. Enable students to discover and complete Islamic learning content.
2. Enable teachers to run live classes, share audio/recorded materials, and track attendance.
3. Enable secure community communication through chats, status posts, and push notifications.
4. Enable admins to manage users, content, payments, privacy, analytics, and moderation.
5. Maintain strong role-based access control and auditability.

## Non-goals
- A full payment gateway UI embedded in the mobile app beyond configured provider/manual flows.
- A custom video stack; Agora is the live media provider.
- Public anonymous learning content access; most data requires verified and approved users.

## Functional requirements
- Authentication: login, signup, password reset, email change, legal acceptance, approval gating.
- Learning: courses, modules, lessons, assignments, audio lessons, quiz attempts/results, progress, certificates.
- Live classes: token issuance, participant presence, attendance events, moderation events, recordings.
- Communication: chat, messages, status feed, reports, notifications, push delivery.
- Payments: user payment submission, admin review, webhook/event logging, reconciliation jobs.
- Admin: users, academic content, library, moderation, payments, analytics, privacy requests, security, push.
- Islamic utilities: prayer times, Qibla, Islamic calendar/dashboard.

## Success metrics
- Successful signup-to-approval conversion.
- Course completion and quiz pass rates.
- Live class join success, attendance capture, and recording availability.
- Push delivery rate and token health.
- Payment verification time and reconciliation failure rate.
- Moderation response time and security incident volume.

## Constraints
- Expo SDK 54 / React Native 0.81.5 compatibility.
- Firestore rules are the source of client-side authorization truth.
- Sensitive operations must use Firebase Auth, App Check where configured, role checks, rate limits, nonce/idempotency, and backend validation.
