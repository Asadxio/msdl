/**
 * mediaNotificationManager.ts — MSDL Feature 2
 * Manages sticky ongoing media playback notifications in Android status bar & lock-screen
 * for Quran Recitation and Madrasa Audio Lessons.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const MEDIA_NOTIFICATION_CHANNEL_ID = 'media_playback';
export const MEDIA_NOTIFICATION_ID = 'msdl_active_audio_playback';

export interface MediaPlaybackMetadata {
  title: string;          // e.g. "Surah Al-Baqarah" or "Dars: Fiqh of Taharah"
  subtitle: string;       // e.g. "Ayat 255 • Mishary Alafasy" or "Ustaadha Fatima"
  isPlaying: boolean;
  playbackRate?: number;
  surahNumber?: number;
  ayatNumber?: number;
}

let isChannelInitialized = false;

/**
 * Initializes the dedicated media notification channel (silent, low disturbance)
 */
export async function initMediaNotificationChannel(): Promise<void> {
  if (isChannelInitialized || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(MEDIA_NOTIFICATION_CHANNEL_ID, {
      name: 'Audio & Quran Playback',
      description: 'Controls and metadata for active Quran and Madrasa audio playback',
      importance: Notifications.AndroidImportance.LOW, // Silent so it does not beep on every new verse
      sound: undefined,
      enableVibrate: false,
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    isChannelInitialized = true;
  } catch (err) {
    console.warn('initMediaNotificationChannel error:', err);
  }
}

/**
 * Shows or updates the ongoing media notification in notification shade and lock-screen
 */
export async function showMediaPlaybackNotification(meta: MediaPlaybackMetadata): Promise<void> {
  try {
    await initMediaNotificationChannel();

    const statusText = meta.isPlaying ? '▶ Playing' : '⏸ Paused';
    const rateText = meta.playbackRate && meta.playbackRate !== 1.0 ? ` (${meta.playbackRate}x)` : '';

    await Notifications.scheduleNotificationAsync({
      identifier: MEDIA_NOTIFICATION_ID,
      content: {
        title: `${meta.title} — ${statusText}${rateText}`,
        body: meta.subtitle,
        data: {
          type: 'media_playback',
          surahNumber: meta.surahNumber,
          ayatNumber: meta.ayatNumber,
        },
        priority: Notifications.AndroidNotificationPriority.LOW,
        sticky: meta.isPlaying, // Sticky when playing so user doesn't accidentally swipe it away
        autoDismiss: false,
      },
      trigger: null, // null trigger presents immediately
    });
  } catch (err) {
    // Media notifications are non-fatal best-effort
    console.warn('showMediaPlaybackNotification error:', err);
  }
}

/**
 * Dismisses the active media playback notification from notification shade
 */
export async function dismissMediaPlaybackNotification(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(MEDIA_NOTIFICATION_ID);
  } catch (err) {
    console.warn('dismissMediaPlaybackNotification error:', err);
  }
}
