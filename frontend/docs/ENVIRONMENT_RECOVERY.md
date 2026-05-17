# Environment Recovery Guide (Install/Lint/Typecheck/Build)

## Verified blocker (as of 2026-05-16 UTC)

The dependency pipeline is blocked by infrastructure policy, not application architecture:

- **Proxy-enabled** install path can reach npm registry but returns `403 Forbidden` for Expo packages.
- **Proxy-disabled** install path fails DNS resolution with `EAI_AGAIN`.

## Required environment conditions

Before running any repo validation commands, ensure all of the following are true:

1. Registry host `registry.npmjs.org` is reachable from CI and developer machines.
2. Proxy policy allows all required Expo packages for SDK 54.
3. Proxy auth (if required) is valid for npm traffic.
4. DNS resolver can resolve npm registry when proxy is bypassed (or proxy is mandatory and correctly configured).

## Quick diagnostics

Run these commands in `frontend/`:

```bash
npm config get registry
npm config list -l | rg "registry|proxy|http-proxy|https-proxy"
env | rg "npm_config|HTTP_PROXY|HTTPS_PROXY|NO_PROXY|http_proxy|https_proxy"
```

Proxy path check:

```bash
npm install --no-audit --no-fund
```

Direct path check (bypass proxy env only for this command):

```bash
env -u npm_config_http_proxy -u npm_config_https_proxy -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy npm ping --registry=https://registry.npmjs.org/
```

## Recovery sequence once network policy is fixed

1. Install deps

```bash
npm install --no-audit --no-fund
```

2. Verify Expo toolchain locally

```bash
npx expo --version
npx expo config --type public
```

3. Validate lint + TypeScript baseline

```bash
npm run lint
npx tsc --noEmit
```

4. Validate prebuild compatibility

```bash
npx expo prebuild --non-interactive --no-install
```

5. Validate EAS config readiness (if EAS is used)

```bash
npx eas --version
npx eas build:configure
```

## Notes

- Do **not** remove Expo-native dependencies to force partial installs.
- Do **not** add fake runtime wrappers to hide missing packages.
- Keep dependency graph explicit and SDK-aligned.
