import * as Updates from 'expo-updates';

export interface UpdateCheckResult {
  isAvailable: boolean;
  manifest?: any;
  error?: string;
}

export async function checkForAppUpdates(): Promise<UpdateCheckResult> {
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  if (isDev) {
    return { isAvailable: false };
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      return { isAvailable: true, manifest: update.manifest };
    }
    return { isAvailable: false };
  } catch (err: any) {
    console.warn('[OTA] Failed to check for app update:', err?.message);
    return { isAvailable: false, error: err?.message };
  }
}

export async function reloadAppWithLatestUpdate(): Promise<void> {
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  if (isDev) return;
  try {
    await Updates.reloadAsync();
  } catch (err: any) {
    console.warn('[OTA] Failed to reload app with update:', err?.message);
  }
}
