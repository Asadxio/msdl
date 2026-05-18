# Frontend (Expo SDK 54)

Production-pilot React Native app built with Expo Router, Firebase, and Agora.

## Current status (2026-05-16 UTC)

Dependency installation is currently blocked by environment/network policy:

- Proxy-enabled npm path reaches registry but returns `403 Forbidden` for required Expo packages.
- Proxy-disabled path fails DNS (`EAI_AGAIN`) for `registry.npmjs.org`.

See `docs/ENVIRONMENT_RECOVERY.md` for recovery steps.

## Baseline commands (run in this folder)

```bash
npm install --no-audit --no-fund
npx expo --version
npx expo config --type public
npm run lint
npx tsc --noEmit
```

## Release safety validation checklist (Phase 1)

Before creating a production APK/AAB, run:

```bash
npx tsc --noEmit
npm run lint
npx expo config --type public
```

Required public env vars (must be present in EAS/CI build profile):

- `EXPO_PUBLIC_LIVE_API_URL`
- `EXPO_PUBLIC_PUSH_API_URL`
- `EXPO_PUBLIC_AGORA_APP_ID`

Firebase rules validation (required in CI/release checklist):

- Firestore rules deployed and tested with emulator scenario checks.
- Storage rules deployed and validated for:
  - student self-upload
  - teacher/admin read path
  - rejected/deactivated user denial

## Dependency/toolchain recovery

Use the runbook:

- `docs/ENVIRONMENT_RECOVERY.md`

This includes:

- required proxy/registry conditions,
- diagnostic commands,
- install validation,
- Expo/EAS verification sequence.

## Production QA execution

Use the QA matrix:

- `docs/PRODUCTION_QA_MATRIX.md`

This matrix covers:

- Android + iOS behavior,
- Agora reconnect and media restoration,
- Firebase realtime/listener cleanup,
- uploads/notifications/attendance/recordings,
- low-network and long-session stability.
