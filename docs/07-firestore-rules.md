# Firestore Rules Documentation

## Global model
- Rules require `request.auth != null` for signed-in checks.
- Approved production access generally requires email verification, an existing `users/{uid}` document, and `status == 'approved'`.
- Roles are read from `users/{uid}.role`; supported roles are `student`, `teacher`, `assistant_teacher`, `moderator`, `admin`, and `super_admin`.
- Unknown documents are denied by the recursive catch-all rule.

## Key helper concepts
- `isApprovedVerifiedUser()`: signed in, email verified, user document exists, approved.
- `isAdmin()`: approved verified `admin` or `super_admin`.
- `isSuperAdmin()`: approved verified `super_admin` only.
- `isTeacherOrAdmin()`: approved verified `teacher`, `assistant_teacher`, `moderator`, `admin`, or `super_admin`.
- `isModerator()`: approved verified `moderator`, `admin`, or `super_admin`.
- Field validation helpers enforce whitelisted keys for users, courses, teachers, library, notifications, payments, chats, messages, status, attendance, live classes, calls, legal, privacy, and notification settings.

## Rule groups
- **Identity:** `users`, `users/{uid}/compliance`, and `public_profiles` allow self-service creation/update with strict key validation; admin has elevated management rights.
- **Learning:** `courses`, `teachers`, `library`, `categories`, `modules`, `lessons`, `assignments`, `audio_lessons`, `lesson_progress`, `submissions`, `quizzes`, `quiz_results`, and `certificates` are read by eligible users and mostly written by admins or owners.
- **Communication:** `chats`, `messages`, `chat_messages`, `status_updates`, comments/reactions/views, reports, and notifications enforce participant/target/role checks.
- **Payments:** users create/submit own pending payments; admins perform state transitions; gateway/audit/verification queues are server-owned.
- **Live media:** `live_classes`, participants, attendance events, moderation events, recordings, `calls`, and call participants enforce class/call membership and teacher/admin privileges.
- **Privacy/security/moderation:** privacy and legal events support owner/admin visibility; security logs are admin-read/server-write; moderation reports/actions are moderator/admin controlled.

## Default deny
`match /{document=**}` denies all read/write for undocumented collections, so new collections require explicit rule entries before client usage.
