const REQUIRED_CONFIG_VARS = [
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
];

const API_FALLBACK_VARS = [
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_LIVE_API_URL',
  'EXPO_PUBLIC_PUSH_API_URL',
];

function normalizeEnvValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw.toLowerCase() === 'undefined' || raw.toLowerCase() === 'null') {
    return '';
  }
  return raw;
}

export function getMissingConfigVars(): string[] {
  const missing = REQUIRED_CONFIG_VARS.filter((name) => {
    const value = normalizeEnvValue(process.env[name]);
    return value.length === 0;
  });

  const hasAnyApiBase = API_FALLBACK_VARS.some((name) => normalizeEnvValue(process.env[name]).length > 0);
  if (!hasAnyApiBase) {
    missing.push(...API_FALLBACK_VARS);
  }

  return missing;
}

export function validateConfig(): void {
  const missingVars = getMissingConfigVars();
  if (missingVars.length === 0) return;

  const needsApiFallbackHint = missingVars.some((name) => API_FALLBACK_VARS.includes(name));
  throw new Error(
    `Missing required environment variable${missingVars.length > 1 ? 's' : ''}: ${missingVars.join(', ')}.` +
    (needsApiFallbackHint ? ' At least one of EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_LIVE_API_URL, or EXPO_PUBLIC_PUSH_API_URL is required.' : ' Please add the missing value(s) to your .env file and restart the app.'),
  );
}
