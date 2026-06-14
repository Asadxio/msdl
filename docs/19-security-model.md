# Security Model

## Authentication and identity
- Firebase Auth is the identity provider.
- Email verification and admin approval gate most application data.
- Roles live in Firestore `users/{uid}.role`; clients must treat UI role checks as hints only.

## Authorization
- Firestore rules are the primary client data authorization layer.
- Backend endpoints re-verify Firebase ID tokens and enforce roles/capabilities for sensitive operations.
- Unknown Firestore collections are denied by default.

## Sensitive operation controls
- Rate limiting and nonce validation are implemented for backend protected operations.
- App Check verification hook exists for backend requests where required.
- Payment operations use state transitions, idempotency, signature verification, and audit logs.
- Security events are written to immutable collections and only readable by admins.

## Data protection
- Self-service user updates are restricted to token/profile/login metadata.
- Admin-only collections protect gateway events, processor logs, verification queues, analytics, and security logs.
- Privacy request and legal audit data is visible only to owner/admin.
- Public Expo env vars must not contain secrets.

## Moderation
- Users can report statuses/messages.
- Moderators/admins can read reports/evidence and create actions.
- Moderators are blocked from acting against admin/super_admin targets by rules.
