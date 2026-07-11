const REQUIRED_CONFIG_VARS = [
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
] as const;

const API_FALLBACK_VARS = [
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_LIVE_API_URL',
  'EXPO_PUBLIC_PUSH_API_URL',
] as const;

type ConfigVarName = typeof REQUIRED_CONFIG_VARS[number] | typeof API_FALLBACK_VARS[number];

const EXPO_PUBLIC_ENV: Record<ConfigVarName, string | undefined> = {
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_LIVE_API_URL: process.env.EXPO_PUBLIC_LIVE_API_URL,
  EXPO_PUBLIC_PUSH_API_URL: process.env.EXPO_PUBLIC_PUSH_API_URL,
};

if (__DEV__) {
  console.log('API_BASE_URL', process.env.EXPO_PUBLIC_API_BASE_URL);
  console.log('FIREBASE_PROJECT_ID', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
  console.log('LIVE_API_URL', process.env.EXPO_PUBLIC_LIVE_API_URL);
  console.log('PUSH_API_URL', process.env.EXPO_PUBLIC_PUSH_API_URL);
}

function normalizeEnvValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw.toLowerCase() === 'undefined' || raw.toLowerCase() === 'null') {
    return '';
  }
  return raw;
}

function getExpoPublicEnvValue(name: ConfigVarName): string {
  return normalizeEnvValue(EXPO_PUBLIC_ENV[name]);
}

export function getMissingConfigVars(): string[] {
  const missing: ConfigVarName[] = REQUIRED_CONFIG_VARS.filter((name) => getExpoPublicEnvValue(name).length === 0);

  const hasAnyApiBase = API_FALLBACK_VARS.some((name) => getExpoPublicEnvValue(name).length > 0);
  if (!hasAnyApiBase) {
    missing.push(...API_FALLBACK_VARS);
  }

  return missing;
}

export function validateConfig(): void {
  const missingVars = getMissingConfigVars();
  if (missingVars.length === 0) return;

  const needsApiFallbackHint = missingVars.some((name) => API_FALLBACK_VARS.includes(name as typeof API_FALLBACK_VARS[number]));
  throw new Error(
    `Missing required environment variable${missingVars.length > 1 ? 's' : ''}: ${missingVars.join(', ')}.` +
    (needsApiFallbackHint ? ' At least one of EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_LIVE_API_URL, or EXPO_PUBLIC_PUSH_API_URL is required.' : ' Please add the missing value(s) to your .env file and restart the app.'),
  );
}
