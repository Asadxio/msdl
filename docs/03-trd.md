# Technical Requirements Document (TRD)

## Architecture requirements
- Frontend must run as an Expo SDK 54 app with Expo Router file-based navigation.
- Backend must expose FastAPI routes under `/api` and initialize Firebase Admin when credentials are present.
- Firestore rules must deny unknown collections by default and explicitly allow each supported collection.
- Live media must use Agora token issuance from backend routes rather than exposing app certificates to clients.
- Push notifications must support Expo push tokens and provider receipt tracking.
- Payment transitions must be state-machine validated and auditable.

## Quality requirements
- TypeScript should compile with `npx tsc --noEmit` after dependencies are installed.
- Backend unit tests should run with `pytest` for security, payment, and Firestore-rule tests.
- Firestore rules should be validated with Firebase Emulator tests before release.
- CI should use `npm ci` from `frontend/package-lock.json` and Python dependency install from `backend/requirements.txt`.

## Data requirements
- Client writes must match field whitelists in `firestore.rules`.
- Server-owned/audit collections must not be writable by clients.
- User metadata updates are limited to push/profile/login fields for self-service.
- Payment, security, and moderation events must be append-only where possible.

## Operational requirements
- Required env vars must be present for production startup.
- Health endpoints must be available for platform monitoring.
- Worker endpoints must be safe to run repeatedly through idempotency and leases.
