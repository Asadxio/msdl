# Dependency Inventory

## Frontend runtime dependencies
- Expo SDK 54 (`expo`, Expo modules for camera, device, document picker, font, image, linking, location, notifications, sensors, sharing, splash screen, system UI, video thumbnails, web browser).
- React 19.1 / React Native 0.81.5 / React Native Web.
- Firebase JS SDK 12.12.x.
- Expo Router 6.
- React Native Agora for live classes/calls.
- Async Storage, gesture handler, reanimated, safe area, screens, maps, webview, vector icons.

## Frontend development dependencies
- TypeScript 5.9.
- Jest 29 and type packages.
- ESLint 9 with Expo config.
- Babel preset/core.

## Backend dependencies
- FastAPI, Uvicorn, Pydantic.
- Firebase Admin.
- MongoDB clients (`pymongo`, `motor`).
- Requests, OAuth, JWT/Jose, cryptography, passlib/bcrypt.
- Pandas/Numpy for analytics.
- Agora token builder.
- Pytest and Python quality tools (`black`, `isort`, `flake8`, `mypy`).

## Dependency risk notes
- Frontend lockfile must stay consistent with `package.json`; CI uses `npm ci`.
- Expo SDK packages should be upgraded through Expo-compatible versions.
- Agora, Firebase, and payment/security libraries should be monitored for security updates.
