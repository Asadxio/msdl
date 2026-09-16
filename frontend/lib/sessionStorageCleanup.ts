import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/lib/logger';

/**
 * Deterministic allowlist of app-global and device-level preferences that MUST survive logout.
 * These settings are intentionally device-specific and non-user-sensitive.
 */
export const PRESERVED_DEVICE_PREFERENCE_KEYS = new Set<string>([
  'MSLB_INSTALLED_v3', // Fresh install sentinel — MUST survive logout so app does not re-trigger fresh install sign-out guard
  '@msdl_app_language', // UI language (English/Urdu/Roman Urdu)
  'settings_theme', // App visual theme (light/dark/system)
  '@msdl_library_theme', // Library reader theme
  'settings_font_size', // Global font scale preference
  'settings_large_text', // Large text accessibility toggle
  'settings_reduce_motion', // Accessibility motion preference
  'settings_wifi_only', // Network usage preference
  'settings_remember_pdf', // PDF viewer page resume preference
  'settings_notifications_enabled', // Device notification toggle
  'settings_notif_sound', // Device notification sound toggle
  'settings_notif_vibration', // Device notification vibration toggle
  'settings_notif_quiet', // Quiet hours preference
  'settings_azan_sound', // Azan sound selection
  'settings_prayer_madhab', // Juristic calculation method (Hanafi / Shafi'i)
  'settings_prayer_method', // Calculation authority method
  'settings_prayer_notifications', // Prayer reminder toggle
  'prayer_settings_v4', // Calculated prayer offsets and offline coordinate cache
  '@msdl_prayer_alarms_config', // Local prayer alarms schedule
  'qibla_location_cache_v1', // Last known Qibla coordinates
  'settings_islamic_reminders', // Islamic daily reminders toggle
  'settings_islamic_reminder_time', // Daily reminder time
  'settings_friday_reminder', // Surah Kahf Friday reminder
  '@msdl_quran_font_size', // Quran Arabic font size preference
  '@msdl_quran_show_roman', // Roman Urdu transliteration display toggle
  '@msdl_quran_audio_speed', // Preferred audio recitation speed (1.0x, 1.25x, etc.)
  '@msdl_downloaded_surahs_index', // Index of physically downloaded audio surahs stored on device
  'mslb_tasbeeh_stats_v2', // Smart Tasbeeh persistent counter
  '@msdl_custom_dhikr_presets', // User custom dhikr definitions
  '@mslb_review_has_rated', // Play Store rating prompt tracking
  '@mslb_review_last_prompt_time', // Play Store rating rate limiter
  '@mslb_soft_update_snooze_until', // Non-mandatory OTA update snooze timestamp
  '@madrasatussalikat/onboarding_entry_completed_version', // Welcome walkthrough completion
]);

export const PRESERVED_DEVICE_PREFERENCE_PREFIXES = [
  '@msdl_quran_cache_', // Downloaded Quran text chapters (safe public Scripture)
];

/**
 * Check whether a given AsyncStorage key should survive logout.
 */
export function isPreservedKey(key: string): boolean {
  if (PRESERVED_DEVICE_PREFERENCE_KEYS.has(key)) {
    return true;
  }
  return PRESERVED_DEVICE_PREFERENCE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Safely cleans up all user-specific and session-sensitive AsyncStorage data upon sign-out.
 * Preserves public utility settings (prayer times, Quran font size, Tasbeeh counter, theme, language).
 */
export async function cleanupSessionStorageOnSignOut(currentUid?: string | null): Promise<{
  removedCount: number;
  preservedCount: number;
}> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove: string[] = [];
    let preservedCount = 0;

    for (const key of allKeys) {
      if (isPreservedKey(key)) {
        preservedCount++;
      } else {
        keysToRemove.push(key);
      }
    }

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      logger.info(`[SessionStorageCleanup] Cleaned ${keysToRemove.length} sensitive keys. Preserved ${preservedCount} device utility keys.`, {
        uid: currentUid || 'anonymous',
      });
    }

    return { removedCount: keysToRemove.length, preservedCount };
  } catch (err) {
    logger.error('[SessionStorageCleanup] Error during selective logout storage cleanup:', err);
    return { removedCount: 0, preservedCount: 0 };
  }
}
