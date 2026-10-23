/**
 * MSLB Automated & Scheduled Routine Notifications Test Suite
 *
 * Verifies:
 * - Deterministic Hadith rotation and content authenticity
 * - Unique notification identifiers and channel routing
 * - Schedule configurations for Daily, Weekly, and Monthly routines
 * - Quiet hours adherence (10:00 PM - 06:00 AM)
 * - Settings synchronization and cancellation behavior
 */

import {
  AUTHENTIC_AHADITH_BANK,
  getDailyRotatingHadith,
  NOTIF_ID_DAILY_HADITH,
  NOTIF_ID_DAILY_TILAWAT,
  NOTIF_ID_DAILY_BEDTIME,
  NOTIF_ID_JUMMAH_KAHF,
  NOTIF_ID_SAAT_IJABAH,
  NOTIF_ID_FASTING_MON,
  NOTIF_ID_FASTING_THU,
  NOTIF_ID_WEEKLY_QUIZ,
  NOTIF_ID_MONTHLY_CARD,
  PREF_MASTER_NOTIF_KEY,
  PREF_ISLAMIC_REMINDERS_KEY,
  PREF_DAILY_HADITH_KEY,
  PREF_DAILY_TILAWAT_KEY,
  PREF_BEDTIME_DUA_KEY,
  PREF_FRIDAY_REMINDER_KEY,
  PREF_SUNNAH_FASTING_KEY,
  PREF_WEEKLY_QUIZ_KEY,
  scheduleDailyHadithAzkar,
  scheduleDailyTilawatReminder,
  scheduleBedtimeDua,
  scheduleJummahReminders,
  scheduleSunnahFastingReminders,
  scheduleWeeklyQuizReminder,
  scheduleMonthlyCardReminder,
  cancelAllAutomatedNotifications,
  syncAutomatedNotificationSchedules,
} from './scheduledDailyNotifications';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('test_id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
    DATE: 'date',
    TIME_INTERVAL: 'timeInterval',
  },
}));

// Mock runtime
jest.mock('@/lib/runtime', () => ({
  isExpoGo: jest.fn().mockReturnValue(false),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('true'),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

describe('MSLB Automated & Routine Notification System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Authentic Hadith & Daily Azkar Collection', () => {
    it('contains at least 10 authentic Ahadith with Arabic, Urdu, and Reference', () => {
      expect(AUTHENTIC_AHADITH_BANK.length).toBeGreaterThanOrEqual(10);
      AUTHENTIC_AHADITH_BANK.forEach((hadith, index) => {
        expect(hadith.arabic).toBeDefined();
        expect(hadith.arabic.length).toBeGreaterThan(5);
        expect(hadith.translationUrdu).toBeDefined();
        expect(hadith.translationUrdu.length).toBeGreaterThan(10);
        expect(hadith.reference).toBeDefined();
        expect(hadith.reference.length).toBeGreaterThan(3);
      });
    });

    it('returns a rotating Hadith deterministically based on date', () => {
      const date1 = new Date(2026, 0, 15);
      const date2 = new Date(2026, 0, 16);
      const hadith1 = getDailyRotatingHadith(date1);
      const hadith2 = getDailyRotatingHadith(date2);

      expect(hadith1).toBeDefined();
      expect(hadith2).toBeDefined();
      // Consecutive days should yield consecutive hadith items
      expect(hadith1.reference).not.toBe(hadith2.reference);
    });

    it('safely handles all 365 days of the year without out-of-bounds error', () => {
      for (let day = 1; day <= 365; day++) {
        const d = new Date(2026, 0, day);
        const hadith = getDailyRotatingHadith(d);
        expect(hadith).toBeDefined();
        expect(hadith.arabic).toBeTruthy();
      }
    });
  });

  describe('2. Notification Identifiers & Preference Keys Uniqueness', () => {
    it('ensures all routine notification identifiers are distinct', () => {
      const ids = [
        NOTIF_ID_DAILY_HADITH,
        NOTIF_ID_DAILY_TILAWAT,
        NOTIF_ID_DAILY_BEDTIME,
        NOTIF_ID_JUMMAH_KAHF,
        NOTIF_ID_SAAT_IJABAH,
        NOTIF_ID_FASTING_MON,
        NOTIF_ID_FASTING_THU,
        NOTIF_ID_WEEKLY_QUIZ,
        NOTIF_ID_MONTHLY_CARD,
      ];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('ensures all preference storage keys are distinct', () => {
      const keys = [
        PREF_MASTER_NOTIF_KEY,
        PREF_ISLAMIC_REMINDERS_KEY,
        PREF_DAILY_HADITH_KEY,
        PREF_DAILY_TILAWAT_KEY,
        PREF_BEDTIME_DUA_KEY,
        PREF_FRIDAY_REMINDER_KEY,
        PREF_SUNNAH_FASTING_KEY,
        PREF_WEEKLY_QUIZ_KEY,
      ];
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe('3. Routine Scheduling & Channels', () => {
    it('schedules Morning Hadith at 06:30 AM on spiritual channel', async () => {
      await scheduleDailyHadithAzkar(true);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: NOTIF_ID_DAILY_HADITH,
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 6,
            minute: 30,
            channelId: 'spiritual',
          }),
        })
      );
    });

    it('schedules Daily Tilawat at 04:30 PM (16:30) on spiritual channel', async () => {
      await scheduleDailyTilawatReminder(true);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: NOTIF_ID_DAILY_TILAWAT,
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 16,
            minute: 30,
            channelId: 'spiritual',
          }),
        })
      );
    });

    it('schedules Bedtime Dua at 09:15 PM (21:15) before quiet hours', async () => {
      await scheduleBedtimeDua(true);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: NOTIF_ID_DAILY_BEDTIME,
          trigger: expect.objectContaining({
            type: 'daily',
            hour: 21,
            minute: 15,
            channelId: 'spiritual',
          }),
        })
      );
    });

    it('schedules Friday Jummah & Sa\'at al-Ijabah reminders on weekday 6', async () => {
      await scheduleJummahReminders(true);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: NOTIF_ID_JUMMAH_KAHF,
          trigger: expect.objectContaining({
            type: 'weekly',
            weekday: 6,
            hour: 8,
            minute: 0,
            channelId: 'spiritual',
          }),
        })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: NOTIF_ID_SAAT_IJABAH,
          trigger: expect.objectContaining({
            type: 'weekly',
            weekday: 6,
            hour: 17,
            minute: 0,
            channelId: 'spiritual',
          }),
        })
      );
    });

    it('schedules Sunnah Fasting reminders on Sunday (1) and Wednesday (4) 07:30 PM', async () => {
      await scheduleSunnahFastingReminders(true);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: NOTIF_ID_FASTING_MON,
          trigger: expect.objectContaining({
            type: 'weekly',
            weekday: 1,
            hour: 19,
            minute: 30,
            channelId: 'reminders',
          }),
        })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: NOTIF_ID_FASTING_THU,
          trigger: expect.objectContaining({
            type: 'weekly',
            weekday: 4,
            hour: 19,
            minute: 30,
            channelId: 'reminders',
          }),
        })
      );
    });

    it('schedules Saturday Weekly Quiz on Saturday (7) 11:00 AM', async () => {
      await scheduleWeeklyQuizReminder(true);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: NOTIF_ID_WEEKLY_QUIZ,
          trigger: expect.objectContaining({
            type: 'weekly',
            weekday: 7,
            hour: 11,
            minute: 0,
            channelId: 'reminders',
          }),
        })
      );
    });

    it('schedules Monthly Progress Card on 1st of month at 10:00 AM', async () => {
      await scheduleMonthlyCardReminder(true);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: NOTIF_ID_MONTHLY_CARD,
          trigger: expect.objectContaining({
            type: 'monthly',
            day: 1,
            hour: 10,
            minute: 0,
            channelId: 'reminders',
          }),
        })
      );
    });
  });

  describe('4. Cancellation & Master Synchronization', () => {
    it('cancelAllAutomatedNotifications cancels all 9 routine IDs', async () => {
      await cancelAllAutomatedNotifications();
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(NOTIF_ID_DAILY_HADITH);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(NOTIF_ID_DAILY_TILAWAT);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(NOTIF_ID_DAILY_BEDTIME);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(NOTIF_ID_JUMMAH_KAHF);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(NOTIF_ID_SAAT_IJABAH);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(NOTIF_ID_FASTING_MON);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(NOTIF_ID_FASTING_THU);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(NOTIF_ID_WEEKLY_QUIZ);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(NOTIF_ID_MONTHLY_CARD);
    });

    it('syncAutomatedNotificationSchedules cancels all when masterEnabled is false', async () => {
      await syncAutomatedNotificationSchedules({ masterEnabled: false });
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(NOTIF_ID_DAILY_HADITH);
    });

    it('syncAutomatedNotificationSchedules schedules all active routines when enabled', async () => {
      await syncAutomatedNotificationSchedules({
        masterEnabled: true,
        islamicReminders: true,
        fridayReminder: true,
        sunnahFasting: true,
        dailyHadith: true,
        dailyTilawat: true,
        bedtimeDua: true,
        weeklyQuiz: true,
      });

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: NOTIF_ID_DAILY_HADITH })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: NOTIF_ID_DAILY_TILAWAT })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: NOTIF_ID_DAILY_BEDTIME })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: NOTIF_ID_JUMMAH_KAHF })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: NOTIF_ID_FASTING_MON })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: NOTIF_ID_WEEKLY_QUIZ })
      );
    });
  });
});
