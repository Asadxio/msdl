const truthy = new Set(['1', 'true', 'yes', 'on']);

function env(name: string, fallback = ''): string {
  const value = (process.env as Record<string, string | undefined>)[name];
  return String(value ?? fallback).trim();
}

export const LIVE_OPS = {
  telemetryEnabled: truthy.has(env('EXPO_PUBLIC_LIVE_TELEMETRY_ENABLED', 'true').toLowerCase()),
  crashReportingEnabled: truthy.has(env('EXPO_PUBLIC_LIVE_CRASH_REPORTING_ENABLED', 'true').toLowerCase()),
  emergencyRecordingDisabled: truthy.has(env('EXPO_PUBLIC_LIVE_EMERGENCY_RECORDING_DISABLED', 'false').toLowerCase()),
  reconnectMaxAttempts: Number(env('EXPO_PUBLIC_LIVE_RECONNECT_MAX_ATTEMPTS', '8')) || 8,
  opsEndpoint: env('EXPO_PUBLIC_LIVE_OPS_ENDPOINT', env('EXPO_PUBLIC_LIVE_API_URL', '')),
};
