import fs from 'node:fs';

const required = [
  'EXPO_PUBLIC_APP_ENV',
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('[release-check] missing env:', missing.join(', '));
  process.exitCode = 1;
}

const appJson = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const expo = appJson?.expo || {};
if (!expo?.plugins?.some((p) => Array.isArray(p) ? p[0] === 'expo-notifications' : p === 'expo-notifications')) {
  console.error('[release-check] expo-notifications plugin missing');
  process.exitCode = 1;
}

if (!expo?.android?.permissions?.includes('POST_NOTIFICATIONS')) {
  console.error('[release-check] android POST_NOTIFICATIONS missing');
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log('[release-check] ok');
}
