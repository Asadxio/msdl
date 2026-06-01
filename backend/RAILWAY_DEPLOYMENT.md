# Railway Deployment Guide (Backend)

## 1) Deploy source
- Connect this GitHub repository to Railway.
- Set service root to repository root (uses root `Procfile`).

## 2) Start command
Railway will use:

```procfile
web: uvicorn backend.server:app --host 0.0.0.0 --port ${PORT:-8000}
```

## 3) Required env variables
Copy from `backend/.env.example` and configure in Railway Variables:

- `MONGO_URL`
- `DB_NAME`
- `FIREBASE_SERVICE_ACCOUNT_JSON` (recommended on Railway)
- `AGORA_APP_ID`
- `AGORA_APP_CERTIFICATE`

Optional:
- `AGORA_RTC_TOKEN_TTL_SECONDS`

Legacy Agora Cloud Recording variables are no longer required for the Phase 1 Audio Lessons system. Only set these if you intentionally re-enable the old cloud-recording endpoints:
- `AGORA_CUSTOMER_ID`
- `AGORA_CUSTOMER_SECRET`
- `AGORA_RECORDING_BUCKET`
- `AGORA_RECORDING_ACCESS_KEY`
- `AGORA_RECORDING_SECRET_KEY`
- `AGORA_RECORDING_UID_BASE`
- `AGORA_RECORDING_VENDOR`
- `AGORA_RECORDING_REGION`
- `CORS_ALLOW_ORIGINS`
- `CORS_ALLOW_METHODS`
- `CORS_ALLOW_HEADERS`

## 4) Health check
After deploy, verify:

- `GET https://<your-railway-domain>/health`

Expected:

```json
{"status":"ok"}
```

## 5) Live API endpoint checks
Verify authenticated requests to:
- `POST /api/live-class/token`
- `POST /api/push/send`

Phase 1 recorded lessons use Firebase Storage + Firestore from the mobile app, not Agora Cloud Recording.

## 6) Frontend configuration
Set in frontend `.env` / EAS variables:

```env
EXPO_PUBLIC_API_BASE_URL=https://msdl-production-9afb.up.railway.app/api
EXPO_PUBLIC_LIVE_API_URL=https://msdl-production-9afb.up.railway.app
EXPO_PUBLIC_PUSH_API_URL=https://msdl-production-9afb.up.railway.app
EXPO_PUBLIC_AGORA_APP_ID=<set in EAS/deployment secrets>
```

Rebuild APK/dev build after updating `EXPO_PUBLIC_*` variables.
