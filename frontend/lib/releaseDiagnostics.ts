import Constants from 'expo-constants';
import { ENV, verifyFrontendEnv } from '@/config/environments';
import { isFeatureEnabled } from '@/lib/featureFlags';

export type ReleaseDiagnostics = {
  appEnv: string;
  appVersion: string;
  runtimeVersion: string;
  analyticsEnabled: boolean;
  apiConfigured: boolean;
  firebaseConfigured: boolean;
};

export function getReleaseDiagnostics(): ReleaseDiagnostics {
  const cfg = verifyFrontendEnv();
  return {
    appEnv: ENV,
    appVersion: String(Constants.expoConfig?.version || '0.0.0'),
    runtimeVersion: String(Constants.expoConfig?.runtimeVersion || 'n/a'),
    analyticsEnabled: isFeatureEnabled('analytics', cfg.analyticsEnabled),
    apiConfigured: Boolean(cfg.apiBaseUrl),
    firebaseConfigured: Boolean(cfg.firebaseProjectId),
  };
}
