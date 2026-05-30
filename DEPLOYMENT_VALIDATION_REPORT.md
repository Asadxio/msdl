# Deployment Validation Report

Date: 2026-05-30

## Scope

Validated production configuration wiring for the Expo frontend and Railway backend without printing or committing any sensitive values.

## Frontend environment

| Variable | Status | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | Configured in EAS production profile | Public Railway API base URL with `/api` suffix. |
| `EXPO_PUBLIC_LIVE_API_URL` | Configured in EAS production profile | Public Railway service origin for live class token APIs. |
| `EXPO_PUBLIC_PUSH_API_URL` | Configured in EAS production profile | Public Railway service origin for push APIs. |
| `EXPO_PUBLIC_AGORA_APP_ID` | Configured in EAS production profile | Public Agora App ID only. No certificate is stored in frontend config. |

## Backend environment

Railway must store the following sensitive values as environment variables only. They are intentionally not present in source control and are not printed in this report.

| Area | Required Railway variables | Source-code usage verified |
| --- | --- | --- |
| MongoDB | `MONGO_URL`, `DB_NAME` | `backend/server.py` reads these at startup and initializes `AsyncIOMotorClient`. |
| Firebase Admin | `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS` | `backend/server.py` initializes Firebase Admin from Railway env. |
| Agora RTC | `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, optional `AGORA_RTC_TOKEN_TTL_SECONDS` | `backend/server.py` reads these and builds RTC tokens server-side. |
| Agora Recording | `AGORA_CUSTOMER_ID`, `AGORA_CUSTOMER_SECRET`, `AGORA_RECORDING_BUCKET`, `AGORA_RECORDING_ACCESS_KEY`, `AGORA_RECORDING_SECRET_KEY`, optional recording settings | `backend/server.py` reads these for cloud recording calls. |

## Endpoint validation

| Check | Result | Notes |
| --- | --- | --- |
| Backend health endpoint | Blocked from this environment | Attempted `GET /health` on the Railway URL, but outbound HTTPS tunneling returned proxy `403`. |
| Live class token endpoint | Static route verified; remote call blocked/unauthenticated | Route exists at `POST /api/live-class/token`. It requires a Firebase bearer token and live class access. Remote network attempt was blocked by proxy `403`. |
| Push endpoint | Static route verified; remote call blocked/unauthenticated | Route exists at `POST /api/push/send`. It requires Firebase authentication. Remote network attempt was blocked by proxy `403`. |
| MongoDB connectivity | Requires Railway runtime validation | Source uses Railway `MONGO_URL`/`DB_NAME`; actual connectivity cannot be proven here without Railway secret access and network access. |
| Firebase Admin initialization | Requires Railway runtime validation | Source initializes from Railway env. Actual initialization cannot be proven here without credentials. |
| Agora token generation | Source path verified; requires Railway secret validation | Token generation uses server-side `AGORA_APP_CERTIFICATE`; certificate is not in frontend/source. Actual token generation requires backend secret access and an authenticated live class request. |

## Local validation commands run

- `python` import check for backend dependencies: passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npx expo lint`: passed with existing repository warnings.
- `curl` probes to Railway public endpoints: blocked by the execution environment proxy (`CONNECT tunnel failed, response 403`).

## Follow-up validation to run in Railway or an unblocked network

1. Confirm Railway variables are set for MongoDB, Firebase Admin, Agora RTC, and Agora recording without exposing their values.
2. Call `GET https://msdl-production-9afb.up.railway.app/health` and expect `{"status":"ok"}`.
3. Use an authenticated Firebase user enrolled in an active live class to call `POST /api/live-class/token` and confirm the response contains an Agora RTC token and the public Agora App ID.
4. Use an authenticated Firebase user/admin to call `POST /api/push/send` and confirm the endpoint authenticates and queues/sends as expected.
5. Check Railway logs for successful MongoDB startup and Firebase Admin initialization without logging credential contents.
