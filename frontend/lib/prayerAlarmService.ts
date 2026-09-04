import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  calculatePrayerTimes,
  getPrayerCalculationSettings,
  type PrayerTime,
} from './prayerTimes';
import { loadPrayerSettings, type PrayerSettings } from './prayerStorage';

export const PRAYER_ALARMS_CONFIG_KEY = '@msdl_prayer_alarms_config';
export const PRAYER_ALARM_CHANNEL_ID = 'prayer_alarms';

export interface PrayerAlarmsConfig {
  enabled: boolean;
  fajr: boolean;
  zuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
  reminderMinutesBefore: number; // 0 for exact time, or 10, 15 min before
}

export const DEFAULT_PRAYER_ALARMS_CONFIG: PrayerAlarmsConfig = {
  enabled: true,
  fajr: true,
  zuhr: true,
  asr: true,
  maghrib: true,
  isha: true,
  reminderMinutesBefore: 0,
};

const PRAYER_URDU_MAP: Record<string, { urduName: string; emoji: string }> = {
  Fajr: { urduName: 'فجر', emoji: '🌅' },
  Zuhr: { urduName: 'ظہر', emoji: '☀️' },
  Asr: { urduName: 'عصر', emoji: '🌤️' },
  Maghrib: { urduName: 'مغرب', emoji: '🌇' },
  Isha: { urduName: 'عشاء', emoji: '🌙' },
};

export async function loadPrayerAlarmsConfig(): Promise<PrayerAlarmsConfig> {
  try {
    const raw = await AsyncStorage.getItem(PRAYER_ALARMS_CONFIG_KEY);
    if (raw) {
      return { ...DEFAULT_PRAYER_ALARMS_CONFIG, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('[PrayerAlarmService] Failed to load config:', err);
  }
  return DEFAULT_PRAYER_ALARMS_CONFIG;
}

export async function savePrayerAlarmsConfig(config: PrayerAlarmsConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(PRAYER_ALARMS_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('[PrayerAlarmService] Failed to save config:', err);
  }
}

async function ensurePrayerAlarmChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const Notifications = require('expo-notifications');
    await Notifications.setNotificationChannelAsync(PRAYER_ALARM_CHANNEL_ID, {
      name: 'Namaz & Azan Alarms (نماز الارم)',
      description: 'Offline device-level prayer time alerts and notifications',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 400, 250, 400],
      lightColor: '#0FA958',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  } catch (err) {
    console.warn('[PrayerAlarmService] Error creating alarm channel:', err);
  }
}

/**
 * Cancel all currently scheduled prayer alarms
 */
export async function cancelAllPrayerAlarms(): Promise<void> {
  try {
    const Notifications = require('expo-notifications');
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      const id = notif.identifier;
      if (id && id.startsWith('msdl_prayer_alarm_')) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    }
    console.log('[PrayerAlarmService] Cancelled all existing prayer alarms.');
  } catch (err) {
    console.warn('[PrayerAlarmService] Failed to cancel alarms:', err);
  }
}

/**
 * Schedules offline local notifications on the device for the next 24-48 hours.
 * Works completely OFFLINE without any active internet connection.
 */
export async function scheduleOfflinePrayerAlarms(
  customSettings?: PrayerSettings,
  customConfig?: PrayerAlarmsConfig
): Promise<number> {
  try {
    const Notifications = require('expo-notifications');
    const config = customConfig || (await loadPrayerAlarmsConfig());

    if (!config.enabled) {
      await cancelAllPrayerAlarms();
      return 0;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[PrayerAlarmService] Notification permissions not granted.');
      return 0;
    }

    await ensurePrayerAlarmChannel();
    await cancelAllPrayerAlarms();

    const settings = customSettings || (await loadPrayerSettings());
    const calcSettings = getPrayerCalculationSettings(
      settings.method === 'auto' ? settings.country : settings.method
    );

    const now = new Date();
    let scheduledCount = 0;

    // Schedule for today and tomorrow (48-hour local buffer)
    for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
      const times = calculatePrayerTimes(
        targetDate,
        settings.latitude,
        settings.longitude,
        calcSettings,
        settings.altitude
      );

      const fardPrayers = times.filter((p) => p.kind === 'fard');

      for (const prayer of fardPrayers) {
        const prayerKey = prayer.name.toLowerCase() as keyof Omit<PrayerAlarmsConfig, 'enabled' | 'reminderMinutesBefore'>;
        if (config[prayerKey] === false) {
          continue;
        }

        const prayerTime = new Date(prayer.time);
        const triggerTime = new Date(
          prayerTime.getTime() - (config.reminderMinutesBefore || 0) * 60 * 1000
        );

        // Only schedule if in future
        if (triggerTime.getTime() <= now.getTime() + 5000) {
          continue;
        }

        const prayerMeta = PRAYER_URDU_MAP[prayer.name] || { urduName: prayer.name, emoji: '🕌' };
        const timeFormatted = prayerTime.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        const identifier = `msdl_prayer_alarm_${prayer.name}_${triggerTime.getTime()}`;

        const title = `${prayerMeta.emoji} وقتِ صلاۃ: ${prayerMeta.urduName} (${prayer.name})`;
        const body = config.reminderMinutesBefore > 0
          ? `${prayerMeta.urduName} کا وقت ${config.reminderMinutesBefore} منٹ میں شروع ہونے والا ہے (${timeFormatted})۔ وضو و نماز کی تیاری کریں۔`
          : `${prayerMeta.urduName} کا وقت شروع ہو چکا ہے (${timeFormatted})۔ نماز قائم کریں اور قربِ الٰہی حاصل کریں۔`;

        await Notifications.scheduleNotificationAsync({
          identifier,
          content: {
            title,
            body,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            categoryIdentifier: 'prayer_alarm',
            channelId: PRAYER_ALARM_CHANNEL_ID,
            data: {
              type: 'prayer_alarm',
              prayer: prayer.name,
              time: prayerTime.toISOString(),
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerTime,
          },
        });

        scheduledCount++;
      }
    }

    console.log(`[PrayerAlarmService] Successfully scheduled ${scheduledCount} offline prayer alarms.`);
    return scheduledCount;
  } catch (err) {
    console.warn('[PrayerAlarmService] Failed to schedule offline prayer alarms:', err);
    return 0;
  }
}
