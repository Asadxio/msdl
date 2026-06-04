const REQUIRED_CONFIG_VARS = [
  'EXPO_PUBLIC_LIVE_API_URL',
  'EXPO_PUBLIC_PUSH_API_URL',
  'EXPO_PUBLIC_AGORA_APP_ID',
];

function normalizeEnvValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw.toLowerCase() === 'undefined' || raw.toLowerCase() === 'null') {
    return '';
  }
  return raw;
}

export function getMissingConfigVars(): string[] {
  return REQUIRED_CONFIG_VARS.filter((name) => {
    const value = normalizeEnvValue(process.env[name]);
    return value.length === 0;
  });
}

export function validateConfig(): void {
  const missingVars = getMissingConfigVars();
  if (missingVars.length === 0) return;

  throw new Error(
    `Missing required environment variable${missingVars.length > 1 ? 's' : ''}: ${missingVars.join(', ')}. ` +
    'Please add the missing value(s) to your .env file and restart the app.',
  );
}
