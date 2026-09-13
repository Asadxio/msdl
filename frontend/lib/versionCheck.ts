/**
 * versionCheck.ts
 * Enterprise Force Update & Minimum Version Gate logic for Madrasatu-s-Salikat.
 * Compares semantic versioning and build numbers to require or recommend app updates.
 */

import Constants from 'expo-constants';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface VersionControlConfig {
  min_version: string;             // e.g. "1.0.5" — below this is blocked (hard update)
  min_version_code: number;        // e.g. 38 — below this is blocked (hard update)
  latest_version: string;          // e.g. "1.0.7" — below this is soft update recommended
  latest_version_code: number;     // e.g. 40
  force_update_title_en?: string;
  force_update_message_en?: string;
  force_update_title_ur?: string;
  force_update_message_ur?: string;
  update_url?: string;
  maintenance_mode?: boolean;
  maintenance_message_en?: string;
  maintenance_message_ur?: string;
}

export type VersionStatus = 
  | { type: 'ok' }
  | { type: 'force_update'; title: string; message: string; updateUrl: string; minVersion: string }
  | { type: 'soft_update'; title: string; message: string; updateUrl: string; latestVersion: string }
  | { type: 'maintenance'; message: string };

export const PLAY_STORE_PACKAGE_ID = 'com.madrasatussalikat.lilbanat';
export const PLAY_STORE_MARKET_URL = `market://details?id=${PLAY_STORE_PACKAGE_ID}`;
export const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE_ID}`;

/**
 * Returns current running app version and android versionCode
 */
export function getCurrentAppVersion(): { version: string; versionCode: number } {
  const version = Constants.expoConfig?.version || '1.0.0';
  const versionCode = Constants.expoConfig?.android?.versionCode || 1;
  return { version, versionCode };
}

/**
 * Compares two semantic version strings (e.g. "1.0.7" vs "1.0.6")
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = (v1 || '').split('-')[0].trim();
  const clean2 = (v2 || '').split('-')[0].trim();

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Checks if the current version requires force update, soft update, or is in maintenance mode.
 */
export function evaluateVersionRequirements(
  config: VersionControlConfig,
  current: { version: string; versionCode: number } = getCurrentAppVersion()
): VersionStatus {
  // 1. Check emergency maintenance mode first
  if (config.maintenance_mode) {
    return {
      type: 'maintenance',
      message:
        config.maintenance_message_en ||
        'Madrasatu-s-Salikat is currently undergoing scheduled maintenance. Please check back shortly.',
    };
  }

  const updateUrl = config.update_url || PLAY_STORE_MARKET_URL;

  // 2. Check hard gate (minimum version required)
  const isBelowMinVersion = compareSemver(current.version, config.min_version) < 0;
  const isBelowMinCode = config.min_version_code > 0 && current.versionCode < config.min_version_code;

  if (isBelowMinVersion || isBelowMinCode) {
    return {
      type: 'force_update',
      title: config.force_update_title_en || 'App Update Required',
      message:
        config.force_update_message_en ||
        'A critical update is required to continue using Madrasatu-s-Salikat safely. Please update to the latest version on Google Play.',
      updateUrl,
      minVersion: config.min_version,
    };
  }

  // 3. Check soft update (newer version exists, but current version is still supported)
  const isBelowLatestVersion = compareSemver(current.version, config.latest_version) < 0;
  const isBelowLatestCode = config.latest_version_code > 0 && current.versionCode < config.latest_version_code;

  if (isBelowLatestVersion || isBelowLatestCode) {
    return {
      type: 'soft_update',
      title: 'New Update Available',
      message: `A new version (${config.latest_version}) of Madrasatu-s-Salikat is available with improvements and fixes.`,
      updateUrl,
      latestVersion: config.latest_version,
    };
  }

  return { type: 'ok' };
}

/**
 * Loads the remote version configuration from Firestore `app_settings/version_control`
 * Falls back gracefully to safe defaults so offline students are never blocked if network fails.
 */
export async function fetchRemoteVersionConfig(): Promise<VersionControlConfig | null> {
  try {
    const docRef = doc(db, 'app_settings', 'version_control');
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        min_version: data.min_version || '1.0.0',
        min_version_code: typeof data.min_version_code === 'number' ? data.min_version_code : 1,
        latest_version: data.latest_version || Constants.expoConfig?.version || '1.0.7',
        latest_version_code: typeof data.latest_version_code === 'number' ? data.latest_version_code : 40,
        force_update_title_en: data.force_update_title_en,
        force_update_message_en: data.force_update_message_en,
        force_update_title_ur: data.force_update_title_ur,
        force_update_message_ur: data.force_update_message_ur,
        update_url: data.update_url,
        maintenance_mode: Boolean(data.maintenance_mode),
        maintenance_message_en: data.maintenance_message_en,
        maintenance_message_ur: data.maintenance_message_ur,
      };
    }
    return null;
  } catch (error) {
    // Fail open in case of network or offline mode
    console.log('[VersionCheck] Note: Remote version config unreachable (offline mode active)');
    return null;
  }
}
