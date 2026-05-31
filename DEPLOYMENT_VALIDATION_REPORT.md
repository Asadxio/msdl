# Deployment Validation Report

Date: 2026-05-31

## Scope

This report covers the requested fixes and configuration validation for signup verification messaging, payment categorization, duplicate upload detection, and live/push backend configuration.

## Findings and Fixes

### 1. Signup verification note

- Finding: the signup form did not show the spam/junk-folder reminder near the email field, and the pending verification screen did not repeat that reminder near the verification instructions.
- Fix: added the note `Didn't receive the verification email? Please check your Spam/Junk folder.` to the signup form and pending verification messaging.

### 2. Payments page categorization

- Finding: fees and donation payment types were displayed in one mixed chip group.
- Fix: separated payment choices into distinct `Fees` and `Donations` UI groups without changing the existing payment type values, amount handling, Razorpay opening, or confirmation logic.

### 3. Duplicate upload warning

- Exact trigger: `runMediaUpload` checked `isDuplicateWindow` immediately after media optimization and before the upload completed. The previous implementation also wrote the duplicate-window marker during that check.
- Affected screens: every screen using `uploadUriFile`, including profile photo upload, status media upload, course/assignment uploads, and chat media upload.
- False firing: yes. If the first upload attempt failed and `uploadUriFile` retried the same selected file, the retry could see the marker written by the first pre-upload check and raise `Duplicate upload suppressed.` even though no upload had completed.
- Root cause: duplicate detection combined “check” and “mark” in one function and marked media as duplicate before successful upload completion.
- Fix: made duplicate checking read-only and added explicit duplicate-window registration only after a successful upload URL is returned.

### 4. Live classes configuration

- Finding: source code expects `EXPO_PUBLIC_LIVE_API_URL`, not `EXPO_PUBLIC_LIVE_APL_URL`.
- Finding: production EAS public env config did not include `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_LIVE_API_URL`, or `EXPO_PUBLIC_PUSH_API_URL`, so production builds could miss the live/push backend URLs.
- Fix: added the provided public Railway URLs to the production EAS config and frontend env example.
- Fix: live, call, and push clients now safely fall back to the origin derived from `EXPO_PUBLIC_API_BASE_URL` when the live or push URL is not present.
- Secret handling: no Agora certificate, Firebase Admin credentials, MongoDB URI, or other secret values were added to source control. Backend sensitive values remain expected in Railway environment variables.

## Configuration Validation

### Frontend

- Production EAS public env values were checked locally for:
  - `EXPO_PUBLIC_API_BASE_URL`
  - `EXPO_PUBLIC_LIVE_API_URL`
  - `EXPO_PUBLIC_PUSH_API_URL`
- `EXPO_PUBLIC_AGORA_APP_ID` remains intentionally outside source control and should be supplied through deployment secrets.

### Backend

- Backend source expects these Railway environment variables:
  - `MONGO_URL`
  - `DB_NAME`
  - `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`
  - `AGORA_APP_ID`
  - `AGORA_APP_CERTIFICATE`
  - optional Agora recording credentials for recording APIs
- No backend secrets were printed or committed.

## Endpoint Validation Notes

Network validation from this execution environment was blocked by the configured proxy with HTTP 403 / CONNECT tunnel failures before reaching the Railway service. Because of that environment limitation, authenticated live token generation, push endpoint behavior, MongoDB connectivity through the production API, and Firebase Admin initialization could not be confirmed from this container.

Recommended deployment-side checks without exposing secrets:

1. Confirm Railway variables exist for MongoDB, Firebase Admin, and Agora credentials.
2. Hit `GET /health` on the Railway service.
3. Hit `GET /api/ops/health` and confirm no Firebase service errors are reported.
4. With a valid Firebase ID token, call `POST /api/live-class/token` for an accessible live class and confirm it returns an Agora app id, token, uid, expiry, and channel name.
5. With a valid Firebase ID token, call `POST /api/push/enqueue` and confirm a queue id is created.
6. Call `POST /api/status` with a harmless validation payload and confirm insertion succeeds to validate MongoDB connectivity.

## Local Validation Commands

- `node_modules/.bin/eslint 'app/auth/signup.tsx' 'app/auth/pending.tsx' app/payment.tsx lib/mediaPipeline.ts lib/mediaOptimization.ts lib/liveClasses.ts lib/calls.ts lib/dispatchNotification.ts lib/pushNotifications.ts`
- `node_modules/.bin/tsc --noEmit --pretty false`
- `git diff --check`
- Production EAS public env JSON validation with Node.

## Deep Credential/Configuration Scan Addendum

Date: 2026-05-31

### Local environment availability

The current container does not have deployment secrets loaded. Presence-only checks reported the following runtime variables as missing locally: frontend public API/live/push/Agora values, backend MongoDB values, Firebase Admin credentials, and Agora backend credentials. This does not prove Railway/EAS is missing them; it only means this local shell cannot validate secret values.

### Agora configuration status

- Frontend code reads public Agora App ID from `EXPO_PUBLIC_AGORA_APP_ID`.
- Backend token generation reads `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` from the backend environment.
- Backend token generation safely fails with `Agora credentials are not configured` if either backend Agora value is missing.
- No Agora certificate or other Agora secret was found hardcoded in source during the high-signal secret scan.
- The public Agora App ID itself is not committed in `eas.json`; it must remain supplied through EAS/deployment secrets.

### Firebase configuration status

- Firebase Web config exists in frontend source and includes a Firebase Web API key. This is expected for Firebase client SDK configuration and is not the Firebase Admin private key.
- Firebase Admin initialization is backend-only and reads either `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS` from environment variables.
- No Firebase Admin private key block was found hardcoded in source during the high-signal secret scan.

### MongoDB configuration status

- Backend startup requires `MONGO_URL` and `DB_NAME` from environment variables.
- No concrete MongoDB URI was found hardcoded in source during the high-signal secret scan; examples use placeholders.

### Additional config gap fixed during deep scan

The status reaction client was still using only `EXPO_PUBLIC_PUSH_API_URL`. It now matches the other push/live clients by falling back to `EXPO_PUBLIC_LIVE_API_URL` and then the origin derived from `EXPO_PUBLIC_API_BASE_URL`. Live ops endpoint config now has the same API-base fallback.

### Remaining validation limitation

This environment cannot confirm the actual Railway/EAS secret values because they are not available locally and should not be exposed. Production endpoint checks were also blocked by the configured proxy/CONNECT tunnel with HTTP 403 before reaching Railway.
