# Deployment Guide

## Frontend
1. Install dependencies from `frontend/package-lock.json` with `npm ci`.
2. Configure `.env` from `frontend/.env.example`.
3. Run quality gates: `npx tsc --noEmit`, `npm test`, `npx expo-doctor`, and release readiness script if applicable.
4. Build with Expo/EAS using `frontend/eas.json` for target profiles.
5. Submit mobile artifacts to app stores or deploy web target if enabled.

## Backend
1. Create environment variables from `backend/.env.example`.
2. Install Python dependencies: `pip install -r backend/requirements.txt`.
3. Run tests: `pytest backend`.
4. Start locally: `uvicorn backend.server:app --reload` or production command from `Procfile`/Railway config.
5. Configure CORS origins to the deployed frontend/mobile origins.
6. Confirm `/health`, `/api/`, and `/api/ops/health` behavior.

## Firebase
1. Deploy Firestore rules: `firebase deploy --only firestore:rules`.
2. Deploy indexes from `firestore.indexes.json`.
3. Configure Firebase Auth providers and email verification templates.
4. Provision Firebase Admin credentials for backend.

## Release checklist
- Firestore emulator/rules tests pass.
- `npm ci` passes in CI.
- Backend tests pass.
- Required secrets exist in production environment.
- App Check/CORS/rate limits are production-configured.
- Payment webhook URL and signature secrets are configured.
- Agora credentials and recording storage are configured if live classes are enabled.
