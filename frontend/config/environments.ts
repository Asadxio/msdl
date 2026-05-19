export type AppEnv = 'development' | 'staging' | 'production';

const allowed: AppEnv[] = ['development', 'staging', 'production'];

export function resolveAppEnv(raw = process.env.EXPO_PUBLIC_APP_ENV): AppEnv {
  const v = String(raw || 'development').toLowerCase();
  return (allowed as string[]).includes(v) ? (v as AppEnv) : 'development';
}

export const ENV = resolveAppEnv();

export const ENV_CONFIG = {
  development: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000/api',
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    analyticsEnabled: false,
  },
  staging: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || '',
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    analyticsEnabled: true,
  },
  production: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || '',
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    analyticsEnabled: true,
  },
} as const;

export function verifyFrontendEnv() {
  const cfg = ENV_CONFIG[ENV];
  if (!cfg.apiBaseUrl) throw new Error(`Missing apiBaseUrl for env=${ENV}`);
  if (!cfg.firebaseProjectId) throw new Error(`Missing firebaseProjectId for env=${ENV}`);
  return cfg;
}
