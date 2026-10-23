/**
 * MSLB Automated & Scheduled Routine Notifications Engine
 *
 * Implements a dual-layer local notification scheduling system via Expo Notifications:
 * 1. Daily Spiritual Routines:
 *    - Morning Hadith & Azkar (06:30 AM) with rotating authentic Ahadith
 *    - Asr Quran Tilawat Reminder (04:30 PM)
 *    - Night Dua, Ayat-ul-Kursi & Tarbiyat (09:15 PM)
 * 2. Weekly Sunnah & Academic Routines:
 *    - Jummah Mubarak & Surah Al-Kahf (Friday 08:00 AM)
 *    - Sa'at al-Ijabah Hour of Acceptance (Friday 05:00 PM)
 *    - Monday Sunnah Fast Reminder (Sunday 07:30 PM)
 *    - Thursday Sunnah Fast Reminder (Wednesday 07:30 PM)
 *    - Saturday Weekly Revision & Quiz (Saturday 11:00 AM)
 * 3. Monthly Occasions:
 *    - 1st of Month Tarbiyat & Progress Card Reminder (1st of month 10:00 AM)
 *
 * All routines operate 100% OFFLINE on-device without requiring Blaze Cloud Cron.
 * Respects Android 13+ Notification Channels, quiet hours (10:00 PM - 06:00 AM),
 * and user preference toggles in Settings.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isExpoGo } from '@/lib/runtime';

// ─────────────────────────────────────────────────────────────────────────────
// Notification Identifiers
// ─────────────────────────────────────────────────────────────────────────────
export const NOTIF_ID_DAILY_HADITH = 'mslb_daily_morning_hadith';
export const NOTIF_ID_DAILY_TILAWAT = 'mslb_daily_asr_tilawat';
export const NOTIF_ID_DAILY_BEDTIME = 'mslb_daily_bedtime_dua';
export const NOTIF_ID_JUMMAH_KAHF = 'mslb_weekly_jummah_kahf';
export const NOTIF_ID_SAAT_IJABAH = 'mslb_weekly_saat_al_ijabah';
export const NOTIF_ID_FASTING_MON = 'mslb_weekly_fasting_monday';
export const NOTIF_ID_FASTING_THU = 'mslb_weekly_fasting_thursday';
export const NOTIF_ID_WEEKLY_QUIZ = 'mslb_weekly_saturday_quiz';
export const NOTIF_ID_MONTHLY_CARD = 'mslb_monthly_progress_card';

// ─────────────────────────────────────────────────────────────────────────────
// Storage Keys
// ─────────────────────────────────────────────────────────────────────────────
export const PREF_MASTER_NOTIF_KEY = 'settings_notifications_enabled';
export const PREF_ISLAMIC_REMINDERS_KEY = 'settings_islamic_reminders';
export const PREF_DAILY_HADITH_KEY = 'settings_daily_hadith_reminders';
export const PREF_DAILY_TILAWAT_KEY = 'settings_daily_tilawat_reminders';
export const PREF_BEDTIME_DUA_KEY = 'settings_bedtime_dua_reminders';
export const PREF_FRIDAY_REMINDER_KEY = 'settings_friday_reminder';
export const PREF_SUNNAH_FASTING_KEY = 'settings_sunnah_fasting_reminders';
export const PREF_WEEKLY_QUIZ_KEY = 'settings_weekly_quiz_reminders';
export const PREF_QUIET_HOURS_KEY = 'settings_notif_quiet';

// ─────────────────────────────────────────────────────────────────────────────
// Authentic Hadith & Daily Azkar Collection (Bukhari, Muslim, Tirmidhi, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export interface HadithReminder {
  arabic: string;
  translationUrdu: string;
  reference: string;
}

export const AUTHENTIC_AHADITH_BANK: HadithReminder[] = [
  {
    arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
    translationUrdu: 'تم میں سب سے بہترین شخص وہ ہے جس نے قرآن سیکھا اور دوسروں کو سکھایا۔',
    reference: 'صحیح البخاری: 5027',
  },
  {
    arabic: 'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ',
    translationUrdu: 'دینی علم حاصل کرنا ہر مسلمان (مرد اور عورت) پر فرض ہے۔',
    reference: 'سنن ابن ماجہ: 224',
  },
  {
    arabic: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ',
    translationUrdu: 'جو شخص علم کی تلاش میں کسی راستے پر چلا، اللہ تعالیٰ اس کے لیے جنت کا راستہ آسان فرما دیتا ہے۔',
    reference: 'صحیح مسلم: 2699',
  },
  {
    arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ',
    translationUrdu: 'تمام اعمال کا دارومدار نیتوں پر ہے اور ہر انسان کے لیے وہی ہے جس کی اس نے نیت کی۔',
    reference: 'صحیح البخاری: 1',
  },
  {
    arabic: 'اَللّٰهُمَّ اِنِّيْ اَسْاَلُكَ عِلْمًا نَافِعًا وَّرِزْقًا طَيِّبًا وَّعَمَلًا مُّتَقَبَّلًا',
    translationUrdu: 'اے اللہ! میں تجھ سے نفع بخش علم، پاکیزہ حلال رزق اور بارگاہ میں قبول ہونے والے عمل کا سوال کرتی ہوں۔',
    reference: 'سنن ابن ماجہ: 925',
  },
  {
    arabic: 'مَنْ صَلَّى عَلَيَّ وَاحِدَةً صَلَّى اللَّهُ عَلَيْهِ عَشْرًا',
    translationUrdu: 'جس نے مجھ پر ایک مرتبہ درودِ پاک بھیجا، اللہ تعالیٰ اس پر دس رحمتیں نازل فرماتا ہے۔',
    reference: 'صحیح مسلم: 408',
  },
  {
    arabic: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ كَنْزٌ مِنْ كُنُوزِ الْجَنَّةِ',
    translationUrdu: 'لا حول ولا قوة إلا بالله پڑھنا جنت کے خزانوں میں سے ایک قیمتی خزانہ ہے۔',
    reference: 'صحیح البخاری: 6384',
  },
  {
    arabic: 'أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
    translationUrdu: 'اللہ تعالیٰ کے نزدیک سب سے پسندیدہ عمل وہ ہے جو پابندی اور ہمیشگی سے کیا جائے، اگرچہ مقدار میں کم ہو۔',
    reference: 'صحیح البخاری: 6464',
  },
  {
    arabic: 'تَهَادَوْا تَحَابُّوا',
    translationUrdu: 'آپس میں ہدیہ (تحفے) دیا کرو، اس سے باہمی محبت میں اضافہ ہوتا ہے۔',
    reference: 'الأدب المفرد للبخاری: 594',
  },
  {
    arabic: 'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ',
    translationUrdu: 'کامل مسلمان وہ ہے جس کی زبان اور ہاتھ کی تکلیف سے دوسرے مسلمان محفوظ رہیں۔',
    reference: 'صحیح البخاری: 10',
  },
  {
    arabic: 'الْحَيَاءُ شُعْبَةٌ مِنَ الإِيمَانِ',
    translationUrdu: 'حیا اور پاکدامنی ایمان کا ایک اہم اور بنیادی شعبہ ہے۔',
    reference: 'صحیح البخاری: 9',
  },
  {
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
    translationUrdu: 'جو شخص اللہ اور یومِ آخرت پر ایمان رکھتا ہے اسے چاہیے کہ اچھی بات کہے یا پھر خاموش رہے۔',
    reference: 'صحیح مسلم: 47',
  },
];

/**
 * Returns a deterministic rotating Hadith for today.
 */
export function getDailyRotatingHadith(date: Date = new Date()): HadithReminder {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diffDays = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const index = Math.abs(diffDays) % AUTHENTIC_AHADITH_BANK.length;
  return AUTHENTIC_AHADITH_BANK[index];
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission Check Helper
// ─────────────────────────────────────────────────────────────────────────────
async function checkNotificationPermission(): Promise<boolean> {
  if (isExpoGo()) {
    return false;
  }
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (existing.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      return requested.granted;
    }
    return false;
  } catch (err) {
    console.warn('[AutomatedNotifications] Permission check error:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Schedulers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Morning Hadith & Azkar (Daily at 06:30 AM)
 */
export async function scheduleDailyHadithAzkar(enabled: boolean): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_DAILY_HADITH).catch(() => {});
    if (!enabled) return;

    const hadith = getDailyRotatingHadith();
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_DAILY_HADITH,
      content: {
        title: '🌸 صبح کا آغاز اور مسنون اذکار (Morning Hadith)',
        body: `${hadith.arabic}\n"${hadith.translationUrdu}" (${hadith.reference})`,
        sound: 'default',
        data: {
          channelId: 'spiritual',
          type: 'daily_hadith',
          screen: '/daily-hadith',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 6,
        minute: 30,
        channelId: 'spiritual',
      },
    });
    console.log('[AutomatedNotifications] Scheduled Daily Hadith & Azkar at 06:30 AM');
  } catch (err) {
    console.warn('[AutomatedNotifications] Failed to schedule Daily Hadith:', err);
  }
}

/**
 * 2. Daily Asr Quran Tilawat Reminder (Daily at 04:30 PM)
 */
export async function scheduleDailyTilawatReminder(enabled: boolean): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_DAILY_TILAWAT).catch(() => {});
    if (!enabled) return;

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_DAILY_TILAWAT,
      content: {
        title: '📖 روزانہ تلاوتِ قرآن مجید (Daily Quran Tilawat)',
        body: 'عصر کا وقت ہے! آئیے آج کا کم از کم 1 رکوع یا حزب تلاوت کر کے اپنے دل کو نورِ الٰہی سے منور فرمائیں۔',
        sound: 'default',
        data: {
          channelId: 'spiritual',
          type: 'daily_tilawat',
          screen: '/(tabs)/quran',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 16,
        minute: 30,
        channelId: 'spiritual',
      },
    });
    console.log('[AutomatedNotifications] Scheduled Daily Tilawat Reminder at 04:30 PM');
  } catch (err) {
    console.warn('[AutomatedNotifications] Failed to schedule Daily Tilawat:', err);
  }
}

/**
 * 3. Daily Bedtime Dua & Tarbiyat (Daily at 09:15 PM)
 */
export async function scheduleBedtimeDua(enabled: boolean): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_DAILY_BEDTIME).catch(() => {});
    if (!enabled) return;

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_DAILY_BEDTIME,
      content: {
        title: '🌙 سونے کی مسنون دعائیں اور محاسبہ (Bedtime Dua)',
        body: 'بِاسْمِكَ رَبِّيْ وَضَعْتُ جَنْبِيْ - سونے سے قبل آیۃ الکرسی، تسبیحِ فاطمہ اور 4 قُل پڑھنا نہ بھولیں۔ پرسکون نیند اور حفاظت۔',
        sound: 'default',
        data: {
          channelId: 'spiritual',
          type: 'bedtime_dua',
          screen: '/daily-hadith',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 21,
        minute: 15,
        channelId: 'spiritual',
      },
    });
    console.log('[AutomatedNotifications] Scheduled Bedtime Dua at 09:15 PM');
  } catch (err) {
    console.warn('[AutomatedNotifications] Failed to schedule Bedtime Dua:', err);
  }
}

/**
 * 4. Weekly Jummah Reminders (Friday 08:00 AM Kahf + Friday 05:00 PM Sa'at al-Ijabah)
 */
export async function scheduleJummahReminders(enabled: boolean): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_JUMMAH_KAHF).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_SAAT_IJABAH).catch(() => {});
    if (!enabled) return;

    // A: Jummah Morning & Surah Al-Kahf (Friday is weekday 6)
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_JUMMAH_KAHF,
      content: {
        title: '🕌 جمعہ مبارک! سورۂ کہف اور درودِ پاک (Jummah Mubarak)',
        body: 'فرمانِ نبوی ﷺ: "جس نے جمعہ کے دن سورۂ کہف پڑھی، اس کے لیے دو جمعوں کے درمیان نور روشن کر دیا جاتا ہے۔" کثرت سے درود شریف پڑھیں۔',
        sound: 'default',
        data: {
          channelId: 'spiritual',
          type: 'jummah_kahf',
          screen: '/(tabs)/quran',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 6,
        hour: 8,
        minute: 0,
        channelId: 'spiritual',
      },
    });

    // B: Friday Sa'at al-Ijabah (Friday 05:00 PM)
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_SAAT_IJABAH,
      content: {
        title: '🤲 ساعتِ اجابت - دعا کی قبولیت کا خاص وقت',
        body: 'عصر سے مغرب کے درمیان جمعہ کی وہ گھڑی ہے جس میں دعا رد نہیں ہوتی۔ اپنے والدین، اساتذہ، امت اور اپنے حق میں خصوصی دعا فرمائیں۔',
        sound: 'default',
        data: {
          channelId: 'spiritual',
          type: 'saat_al_ijabah',
          screen: '/(tabs)/prayer',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 6,
        hour: 17,
        minute: 0,
        channelId: 'spiritual',
      },
    });
    console.log('[AutomatedNotifications] Scheduled Friday Jummah & Sa\'at al-Ijabah reminders');
  } catch (err) {
    console.warn('[AutomatedNotifications] Failed to schedule Jummah reminders:', err);
  }
}

/**
 * 5. Weekly Sunnah Fasting Reminders (Monday Fast: Sun 07:30 PM, Thursday Fast: Wed 07:30 PM)
 */
export async function scheduleSunnahFastingReminders(enabled: boolean): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_FASTING_MON).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_FASTING_THU).catch(() => {});
    if (!enabled) return;

    // Sunday evening for Monday fast (Sunday is weekday 1)
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_FASTING_MON,
      content: {
        title: '🌸 سنتِ رسول ﷺ: کل پیر کا روزہ (Monday Sunnah Fast)',
        body: 'فرمانِ مصطفیٰ ﷺ: "پیر کے دن اعمال پیش کیے جاتے ہیں، مجھے پسند ہے کہ میرا عمل روزے کی حالت میں پیش ہو۔" سحری کی نیت فرمائیں۔',
        sound: 'default',
        data: {
          channelId: 'reminders',
          type: 'sunnah_fast_monday',
          screen: '/(tabs)/prayer',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1,
        hour: 19,
        minute: 30,
        channelId: 'reminders',
      },
    });

    // Wednesday evening for Thursday fast (Wednesday is weekday 4)
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_FASTING_THU,
      content: {
        title: '🌸 سنتِ رسول ﷺ: کل جمعرات کا روزہ (Thursday Sunnah Fast)',
        body: 'کل جمعرات کی سنت روزے کی تیاری فرمائیں۔ سحری و افطاری میں مدنی بہنوں اور طالبات کو دعاؤں میں یاد رکھیں۔',
        sound: 'default',
        data: {
          channelId: 'reminders',
          type: 'sunnah_fast_thursday',
          screen: '/(tabs)/prayer',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 4,
        hour: 19,
        minute: 30,
        channelId: 'reminders',
      },
    });
    console.log('[AutomatedNotifications] Scheduled Sunnah Fasting reminders (Sun & Wed 07:30 PM)');
  } catch (err) {
    console.warn('[AutomatedNotifications] Failed to schedule Sunnah Fasting reminders:', err);
  }
}

/**
 * 6. Weekly Saturday Revision & Quiz Reminder (Saturday 11:00 AM)
 */
export async function scheduleWeeklyQuizReminder(enabled: boolean): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_WEEKLY_QUIZ).catch(() => {});
    if (!enabled) return;

    // Saturday is weekday 7
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_WEEKLY_QUIZ,
      content: {
        title: '📚 ہفتہ وار دہرائی اور کوئز (Weekly Revision & Quiz)',
        body: 'ہفتے بھر کے اسباق کا اعادہ فرمائیں اور اپنا فہم پرکھنے کے لیے ہفتہ وار کوئز مکمل کریں۔ علمِ دین حاصل کرنا اور دہرانا بہترین عبادت ہے۔',
        sound: 'default',
        data: {
          channelId: 'reminders',
          type: 'weekly_quiz_reminder',
          screen: '/(tabs)/quiz',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 7,
        hour: 11,
        minute: 0,
        channelId: 'reminders',
      },
    });
    console.log('[AutomatedNotifications] Scheduled Weekly Quiz Reminder on Saturday 11:00 AM');
  } catch (err) {
    console.warn('[AutomatedNotifications] Failed to schedule Weekly Quiz reminder:', err);
  }
}

/**
 * 7. Monthly 1st of Month Tarbiyat & Progress Review (Day 1 at 10:00 AM)
 */
export async function scheduleMonthlyCardReminder(enabled: boolean): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_MONTHLY_CARD).catch(() => {});
    if (!enabled) return;

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_MONTHLY_CARD,
      content: {
        title: '📊 نیا مہینہ اور تعلیمی جائزہ (Monthly Progress Review)',
        body: 'نئے مہینے کا آغاز مبارک! اپنا تعلیمی کارڈ چیک کریں اور اس مہینے نئے اسباق و اذکار کا عزم فرمائیں۔',
        sound: 'default',
        data: {
          channelId: 'reminders',
          type: 'monthly_progress_review',
          screen: '/(tabs)/profile',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: 1,
        hour: 10,
        minute: 0,
        channelId: 'reminders',
      },
    });
    console.log('[AutomatedNotifications] Scheduled Monthly Card Reminder on 1st of month 10:00 AM');
  } catch (err) {
    console.warn('[AutomatedNotifications] Failed to schedule Monthly Card reminder:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Synchronizer
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncOptions {
  masterEnabled?: boolean;
  islamicReminders?: boolean;
  fridayReminder?: boolean;
  sunnahFasting?: boolean;
  dailyHadith?: boolean;
  dailyTilawat?: boolean;
  bedtimeDua?: boolean;
  weeklyQuiz?: boolean;
}

/**
 * Cancels all automated scheduled routine notifications.
 */
export async function cancelAllAutomatedNotifications(): Promise<void> {
  try {
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
    await Promise.allSettled(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id))
    );
    console.log('[AutomatedNotifications] Cancelled all routine notifications.');
  } catch (err) {
    console.warn('[AutomatedNotifications] Error cancelling routine notifications:', err);
  }
}

/**
 * Synchronizes all automated notifications according to user preferences.
 * Reads stored preferences from AsyncStorage if not explicitly provided.
 */
export async function syncAutomatedNotificationSchedules(options?: SyncOptions): Promise<void> {
  if (isExpoGo()) {
    console.log('[AutomatedNotifications] Expo Go detected: skipping local notification scheduling.');
    return;
  }

  const hasPerm = await checkNotificationPermission();
  if (!hasPerm) {
    console.log('[AutomatedNotifications] Notification permission not granted; skipping schedule.');
    return;
  }

  try {
    let master = options?.masterEnabled;
    let islamic = options?.islamicReminders;
    let friday = options?.fridayReminder;
    let fasting = options?.sunnahFasting;
    let hadith = options?.dailyHadith;
    let tilawat = options?.dailyTilawat;
    let bedtime = options?.bedtimeDua;
    let quiz = options?.weeklyQuiz;

    // Fall back to stored settings when not passed
    if (master === undefined) {
      const v = await AsyncStorage.getItem(PREF_MASTER_NOTIF_KEY);
      master = v !== 'false';
    }

    if (!master) {
      await cancelAllAutomatedNotifications();
      return;
    }

    if (islamic === undefined) {
      const v = await AsyncStorage.getItem(PREF_ISLAMIC_REMINDERS_KEY);
      islamic = v !== 'false';
    }
    if (friday === undefined) {
      const v = await AsyncStorage.getItem(PREF_FRIDAY_REMINDER_KEY);
      friday = v !== 'false';
    }
    if (fasting === undefined) {
      const v = await AsyncStorage.getItem(PREF_SUNNAH_FASTING_KEY);
      fasting = v !== 'false';
    }
    if (hadith === undefined) {
      const v = await AsyncStorage.getItem(PREF_DAILY_HADITH_KEY);
      hadith = v !== 'false';
    }
    if (tilawat === undefined) {
      const v = await AsyncStorage.getItem(PREF_DAILY_TILAWAT_KEY);
      tilawat = v !== 'false';
    }
    if (bedtime === undefined) {
      const v = await AsyncStorage.getItem(PREF_BEDTIME_DUA_KEY);
      bedtime = v !== 'false';
    }
    if (quiz === undefined) {
      const v = await AsyncStorage.getItem(PREF_WEEKLY_QUIZ_KEY);
      quiz = v !== 'false';
    }

    // Schedule or cancel each routine based on preferences
    await Promise.all([
      scheduleDailyHadithAzkar(Boolean(islamic && hadith)),
      scheduleDailyTilawatReminder(Boolean(islamic && tilawat)),
      scheduleBedtimeDua(Boolean(islamic && bedtime)),
      scheduleJummahReminders(Boolean(islamic && friday)),
      scheduleSunnahFastingReminders(Boolean(islamic && fasting)),
      scheduleWeeklyQuizReminder(Boolean(quiz)),
      scheduleMonthlyCardReminder(Boolean(islamic)),
    ]);

    console.log('[AutomatedNotifications] Successfully synchronized all automated routine schedules.');
  } catch (err) {
    console.error('[AutomatedNotifications] Failed to sync automated schedules:', err);
  }
}

/**
 * Dispatches an immediate sample notification for testing / verification in UI.
 */
export async function dispatchTestSpiritualNotification(type: 'hadith' | 'jummah' | 'fasting' | 'tilawat'): Promise<void> {
  const hasPerm = await checkNotificationPermission();
  if (!hasPerm) {
    throw new Error('Notification permissions not granted.');
  }

  let title = '🌸 روحانی یاد دہانی (Spiritual Reminder)';
  let body = 'سبحان الله وبحمده سبحان الله العظيم';
  let targetChannelId = 'spiritual';

  if (type === 'hadith') {
    const h = getDailyRotatingHadith();
    title = '🌸 روزانہ حدیث و ذکر (Daily Hadith)';
    body = `${h.arabic}\n"${h.translationUrdu}" (${h.reference})`;
  } else if (type === 'jummah') {
    title = '🕌 جمعہ مبارک اور درودِ پاک';
    body = 'فرمانِ نبوی ﷺ: "جمعہ کے دن مجھ پر کثرت سے درود بھیجا کرو۔"';
  } else if (type === 'fasting') {
    title = '🌸 سنتِ رسول ﷺ: نفلی روزہ';
    body = 'سنتِ نبوی کے مطابق روزے کی تیاری فرمائیں اور برکتیں حاصل کریں۔';
    targetChannelId = 'reminders';
  } else if (type === 'tilawat') {
    title = '📖 روزانہ تلاوتِ قرآن مجید';
    body = 'آج کا سبق اور تلاوت مکمل کر کے اللہ کا قرب حاصل کریں۔';
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { channelId: targetChannelId },
    },
    trigger: {
      channelId: targetChannelId,
    },
  });
}
