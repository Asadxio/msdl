import fs from 'node:fs';

const required = [
  'EXPO_PUBLIC_APP_ENV',
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
];

const fallbackApiVars = [
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_LIVE_API_URL',
  'EXPO_PUBLIC_PUSH_API_URL',
];

const missing = required.filter((k) => !process.env[k]);
if (!fallbackApiVars.some((k) => process.env[k])) {
  missing.push(...fallbackApiVars);
}

if (missing.length) {
  console.error('[release-check] missing env:', [...new Set(missing)].join(', '));
  process.exitCode = 1;
}



const placeholderValues = required.filter((k) => /YOUR-|your_|localhost|127\.0\.0\.1/i.test(String(process.env[k] || '')));
if (process.env.EXPO_PUBLIC_APP_ENV === 'production' && placeholderValues.length) {
  console.error('[release-check] production env contains placeholder/local values:', placeholderValues.join(', '));
  process.exitCode = 1;
}

const appJson = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const expo = appJson?.expo || {};
if (!expo?.plugins?.some((p) => Array.isArray(p) ? p[0] === 'expo-notifications' : p === 'expo-notifications')) {
  console.error('[release-check] expo-notifications plugin missing');
  process.exitCode = 1;
}

const androidPermissions = expo?.android?.permissions || [];
if (!androidPermissions.includes('POST_NOTIFICATIONS') && !androidPermissions.includes('android.permission.POST_NOTIFICATIONS')) {
  console.error('[release-check] android POST_NOTIFICATIONS missing');
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log('[release-check] ok');
}
