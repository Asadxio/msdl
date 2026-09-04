import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, Switch, Alert, ScrollView, Linking, Platform, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTutorial } from '@/context/TutorialContext';
import { useTheme } from '@/context/ThemeContext';
import { getNotificationPreferences, updateNotificationPreferences, type NotificationChannel } from '@/lib/notificationCenter';
import Constants from 'expo-constants';
import { WHATSAPP_HELP_URL, MADRASA_WEBSITE_URL, MADRASA_WEBSITE_DISPLAY } from '@/lib/links';
import AdminHealthDashboard from '@/components/AdminHealthDashboard';
import { useLanguage, type Language } from '@/context/LanguageContext';
import { LanguageSwitcherSheet } from '@/components/LanguageSwitcherSheet';
import { BugReportModal, FeatureSuggestModal, FaqModal } from '@/components/SupportModals';
import * as Notifications from 'expo-notifications';
import { clearQuizCounts } from '@/lib/lmsHardening';

const NOTIFICATION_PREF_KEY = 'settings_notifications_enabled';
const LARGE_TEXT_PREF_KEY = 'settings_large_text';
const THEME_PREF_KEY = 'settings_theme';
const FONT_SIZE_PREF_KEY = 'settings_font_size';
const REDUCE_MOTION_PREF_KEY = 'settings_reduce_motion';
const APP_LOCK_KEY = 'settings_app_lock_enabled';
const APP_PIN_KEY = 'settings_app_pin';
const HIDE_SENSITIVE_KEY = 'settings_hide_sensitive';
const AUTO_RESUME_KEY = 'settings_auto_resume';
const AUTO_PLAY_KEY = 'settings_auto_play';
const WIFI_ONLY_KEY = 'settings_wifi_only';
const REMEMBER_PDF_KEY = 'settings_remember_pdf';
const PRAYER_METHOD_KEY = 'settings_prayer_method';
const PRAYER_MADHAB_KEY = 'settings_prayer_madhab';
const PRAYER_NOTIF_KEY = 'settings_prayer_notifications';
const ISLAMIC_REMINDERS_KEY = 'settings_islamic_reminders';
const NOTIF_SOUND_KEY = 'settings_notif_sound';
const NOTIF_VIBRATION_KEY = 'settings_notif_vibration';
const NOTIF_QUIET_KEY = 'settings_notif_quiet';
const AZAN_SOUND_KEY = 'settings_azan_sound';
const FRIDAY_REMINDER_KEY = 'settings_friday_reminder';
const ISLAMIC_REMINDER_TIME_KEY = 'settings_islamic_reminder_time';

type SectionProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function SettingsSection({ title, icon, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.sectionIconCircle}>
            <Ionicons name={icon} size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
      {open && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { setShowTutorial, setCurrentStep } = useTutorial();
  const { language, setLanguage, languageName } = useLanguage();
  const { setThemeMode, setFontSizeScale } = useTheme();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [bugModalVisible, setBugModalVisible] = useState(false);
  const [featureModalVisible, setFeatureModalVisible] = useState(false);
  const [faqModalVisible, setFaqModalVisible] = useState(false);
  
  // Admin Diagnostics State
  const [diagLogsVisible, setDiagLogsVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [statusAuth, setStatusAuth] = useState<'Checking...' | 'Connected' | 'Disconnected'>('Checking...');
  const [statusDb, setStatusDb] = useState<'Checking...' | 'Connected' | 'Disconnected'>('Checking...');
  const [statusNet, setStatusNet] = useState<'Checking...' | 'Connected' | 'Disconnected'>('Checking...');
  const [statusPush, setStatusPush] = useState<'Checking...' | 'Connected' | 'Disconnected'>('Checking...');

  const checkDiagnostics = async () => {
    if (profile?.role !== 'admin') return;
    setChecking(true);
    setStatusAuth('Checking...');
    setStatusDb('Checking...');
    setStatusNet('Checking...');
    setStatusPush('Checking...');
    
    setStatusAuth(user?.uid ? 'Connected' : 'Disconnected');
    try {
      await fetch('https://dns.google', { method: 'HEAD', mode: 'no-cors' });
      setStatusNet('Connected');
    } catch {
      setStatusNet('Disconnected');
    }
    
    try {
      const { db } = require('@/config/firebase');
      setStatusDb(db ? 'Connected' : 'Disconnected');
    } catch {
      setStatusDb('Disconnected');
    }
    
    try {
      const Notifications = require('expo-notifications');
      const settings = await Notifications.getPermissionsAsync();
      setStatusPush(settings.granted ? 'Connected' : 'Disconnected');
    } catch {
      setStatusPush('Disconnected');
    }
    setChecking(false);
  };

  useEffect(() => {
    if (profile?.role === 'admin') {
      checkDiagnostics();
    }
  }, [profile?.role]);

  // Notification State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifSound, setNotifSound] = useState(true);
  const [notifVibration, setNotifVibration] = useState(true);
  const [notifQuiet, setNotifQuiet] = useState(false);
  const [channelPrefs, setChannelPrefs] = useState<Record<NotificationChannel, boolean>>({
    chat: true, story: true, live_class: true, calls: true, assignments: true, announcements: true, attendance: true, admin: true,
  });

  // Appearance State
  const [largeText, setLargeText] = useState(false);
  const [theme, setTheme] = useState<'System Default' | 'Light Mode' | 'Dark Mode'>('System Default');
  const [fontSize, setFontSize] = useState<'Small' | 'Medium' | 'Large' | 'Extra Large'>('Medium');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [fontSizeModalVisible, setFontSizeModalVisible] = useState(false);

  // Privacy & Security State
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [appPin, setAppPin] = useState('1234');
  const [hideSensitive, setHideSensitive] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState<'enter' | 'create' | 'confirm'>('enter');

  // Learning Preferences State
  const [autoResume, setAutoResume] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [rememberPdf, setRememberPdf] = useState(true);

  // Islamic Features State
  const [prayerMethod, setPrayerMethod] = useState('umm_al_qura');
  const [prayerMadhab, setPrayerMadhab] = useState('hanafi');
  const [prayerNotifications, setPrayerNotifications] = useState(true);
  const [islamicReminders, setIslamicReminders] = useState(true);
  const [azanSound, setAzanSound] = useState(true);
  const [fridayReminder, setFridayReminder] = useState(true);
  const [reminderTime, setReminderTime] = useState('09:00 AM');

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const vals = await Promise.all([
          AsyncStorage.getItem(NOTIFICATION_PREF_KEY),
          AsyncStorage.getItem(LARGE_TEXT_PREF_KEY),
          AsyncStorage.getItem(PRAYER_METHOD_KEY),
          AsyncStorage.getItem(PRAYER_NOTIF_KEY),
          AsyncStorage.getItem(ISLAMIC_REMINDERS_KEY),
          AsyncStorage.getItem(NOTIF_SOUND_KEY),
          AsyncStorage.getItem(NOTIF_VIBRATION_KEY),
          AsyncStorage.getItem(NOTIF_QUIET_KEY),
          AsyncStorage.getItem(PRAYER_MADHAB_KEY),
          AsyncStorage.getItem(AZAN_SOUND_KEY),
          AsyncStorage.getItem(FRIDAY_REMINDER_KEY),
          AsyncStorage.getItem(ISLAMIC_REMINDER_TIME_KEY),
          AsyncStorage.getItem(THEME_PREF_KEY),
          AsyncStorage.getItem(FONT_SIZE_PREF_KEY),
          AsyncStorage.getItem(REDUCE_MOTION_PREF_KEY),
          AsyncStorage.getItem(APP_LOCK_KEY),
          AsyncStorage.getItem(APP_PIN_KEY),
          AsyncStorage.getItem(HIDE_SENSITIVE_KEY),
          AsyncStorage.getItem(AUTO_RESUME_KEY),
          AsyncStorage.getItem(AUTO_PLAY_KEY),
          AsyncStorage.getItem(WIFI_ONLY_KEY),
          AsyncStorage.getItem(REMEMBER_PDF_KEY),
        ]);
        
        setNotificationsEnabled(vals[0] !== 'false');
        setLargeText(vals[1] === 'true');
        if (vals[2]) setPrayerMethod(vals[2]);
        setPrayerNotifications(vals[3] !== 'false');
        setIslamicReminders(vals[4] !== 'false');
        setNotifSound(vals[5] !== 'false');
        setNotifVibration(vals[6] !== 'false');
        setNotifQuiet(vals[7] === 'true');
        if (vals[8]) setPrayerMadhab(vals[8]);
        setAzanSound(vals[9] !== 'false');
        setFridayReminder(vals[10] !== 'false');
        if (vals[11]) setReminderTime(vals[11]);
        if (vals[12] && (vals[12] === 'System Default' || vals[12] === 'Light Mode' || vals[12] === 'Dark Mode')) setTheme(vals[12] as any);
        if (vals[13] && (vals[13] === 'Small' || vals[13] === 'Medium' || vals[13] === 'Large' || vals[13] === 'Extra Large')) setFontSize(vals[13] as any);
        setReduceMotion(vals[14] === 'true');
        setAppLockEnabled(vals[15] === 'true');
        if (vals[16]) setAppPin(vals[16]);
        setHideSensitive(vals[17] === 'true');
        setAutoResume(vals[18] !== 'false');
        setAutoPlay(vals[19] !== 'false');
        setWifiOnly(vals[20] === 'true');
        setRememberPdf(vals[21] !== 'false');
      } catch {}
    };
    loadPrefs().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    getNotificationPreferences(user.uid).then((prefs) => {
      setChannelPrefs(prefs.channels);
      setNotificationsEnabled(Object.values(prefs.channels).some(Boolean));
    }).catch(() => {});
  }, [user?.uid]);

  const toggleBooleanPref = async (key: string, value: boolean, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(value);
    await AsyncStorage.setItem(key, value ? 'true' : 'false').catch(() => {});
  };

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem(NOTIFICATION_PREF_KEY, value ? 'true' : 'false').catch(() => {});
    if (user?.uid) {
      const channels = Object.keys(channelPrefs).reduce((acc, k) => ({ ...acc, [k]: value }), {} as Record<NotificationChannel, boolean>);
      setChannelPrefs(channels);
      await updateNotificationPreferences(user.uid, { channels }).catch(() => {});
    }
  };

  const toggleChannel = async (channel: NotificationChannel, value: boolean) => {
    const next = { ...channelPrefs, [channel]: value };
    setChannelPrefs(next);
    setNotificationsEnabled(Object.values(next).some(Boolean));
    if (user?.uid) await updateNotificationPreferences(user.uid, { channels: next }).catch(() => {});
  };

  const handleTestNotification = async () => {
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus === 'granted') {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Madrasatu-s-Salikat Lil Banat 🔔',
              body: 'Test notification delivered successfully with sound & vibration!',
              data: { type: 'test_notification' },
              sound: 'default',
            },
            trigger: null,
          });
          Alert.alert('Test Notification Sent', 'A real test notification has been dispatched to your device status bar.');
          return;
        }
      }
    } catch (e) {
      console.warn('[Settings] Failed to schedule local test notification:', e);
    }
    Alert.alert('Test Notification', 'This is a test notification sound and vibration.');
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear App Cache',
      'Are you sure you want to clear temporary cached data (quiz counts, temporary files)? Your login session will remain active.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearQuizCounts();
              const tempKeys = [
                'library_recently_viewed_books',
                'cached_announcements',
                'offline_library_manifest_temp',
              ];
              await AsyncStorage.multiRemove(tempKeys);
              Alert.alert('Cache Cleared', 'Temporary cache cleared successfully. Fast loading preserved.');
            } catch {
              Alert.alert('Error', 'Failed to clear some cache files.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBackOrReplace(router, '/more')}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings Center</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Section 1: Notifications */}
        <SettingsSection title="Notifications" icon="notifications-outline">
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Enable Notifications</Text>
            <Switch value={notificationsEnabled} onValueChange={toggleNotifications} trackColor={{ true: COLORS.primary }} />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Notification Sound</Text>
            <Switch value={notifSound} onValueChange={(v) => toggleBooleanPref(NOTIF_SOUND_KEY, v, setNotifSound)} trackColor={{ true: COLORS.primary }} />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Vibration</Text>
            <Switch value={notifVibration} onValueChange={(v) => toggleBooleanPref(NOTIF_VIBRATION_KEY, v, setNotifVibration)} trackColor={{ true: COLORS.primary }} />
          </View>
          <View style={styles.row}>
            <View>
              <Text style={styles.rowLabel}>Quiet Hours</Text>
              <Text style={styles.rowSubtext}>10:00 PM - 6:00 AM</Text>
            </View>
            <Switch value={notifQuiet} onValueChange={(v) => toggleBooleanPref(NOTIF_QUIET_KEY, v, setNotifQuiet)} trackColor={{ true: COLORS.primary }} />
          </View>
          <TouchableOpacity style={styles.actionButton} onPress={handleTestNotification}>
            <Text style={styles.actionButtonText}>Test Notification</Text>
          </TouchableOpacity>

          <Text style={styles.sectionSubtitle}>Notification Channels</Text>
          <View style={styles.channelGrid}>
            <View style={styles.row}><Text style={styles.rowLabel}>Chat</Text><Switch value={channelPrefs.chat} onValueChange={(v) => toggleChannel('chat', v)} trackColor={{ true: COLORS.primary }} /></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Live Classes</Text><Switch value={channelPrefs.live_class} onValueChange={(v) => toggleChannel('live_class', v)} trackColor={{ true: COLORS.primary }} /></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Calls</Text><Switch value={channelPrefs.calls} onValueChange={(v) => toggleChannel('calls', v)} trackColor={{ true: COLORS.primary }} /></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Assignments</Text><Switch value={channelPrefs.assignments} onValueChange={(v) => toggleChannel('assignments', v)} trackColor={{ true: COLORS.primary }} /></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Announcements</Text><Switch value={channelPrefs.announcements} onValueChange={(v) => toggleChannel('announcements', v)} trackColor={{ true: COLORS.primary }} /></View>
            {/* Story channel hidden per requirement */}
          </View>
        </SettingsSection>

        {/* Section 2: Appearance & Language */}
        <SettingsSection title="Appearance & Language" icon="color-palette-outline" defaultOpen={false}>
          <TouchableOpacity style={styles.linkRow} onPress={() => setLangModalVisible(true)}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="globe-outline" size={20} color={COLORS.primary} />
              <View>
                <Text style={styles.linkText}>App Language</Text>
                <Text style={styles.linkSubtext}>{languageName}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => setThemeModalVisible(true)}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="moon-outline" size={20} color={COLORS.primary} />
              <View>
                <Text style={styles.linkText}>Theme</Text>
                <Text style={styles.linkSubtext}>{theme}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => setFontSizeModalVisible(true)}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="text-outline" size={20} color={COLORS.primary} />
              <View>
                <Text style={styles.linkText}>Font Size</Text>
                <Text style={styles.linkSubtext}>{fontSize}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Large Text Mode</Text>
            <Switch value={largeText} onValueChange={(v) => toggleBooleanPref(LARGE_TEXT_PREF_KEY, v, setLargeText)} trackColor={{ true: COLORS.primary }} />
          </View>
          
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Reduce Motion</Text>
            <Switch value={reduceMotion} onValueChange={(v) => toggleBooleanPref(REDUCE_MOTION_PREF_KEY, v, setReduceMotion)} trackColor={{ true: COLORS.primary }} />
          </View>

          <TouchableOpacity style={styles.linkRow} onPress={() => {
            setCurrentStep('dashboard');
            setShowTutorial(true);
          }}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="play-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.linkText}>Replay Tutorial</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </SettingsSection>

        {/* Section 3: Islamic Features */}
        <SettingsSection title="Islamic Features" icon="star-outline" defaultOpen={false}>
          <TouchableOpacity style={styles.linkRow} onPress={() => {
            const methods = ['Umm al-Qura', 'Muslim World League', 'ISNA', 'Egyptian General Authority'];
            Alert.alert('Calculation Method', 'Select preferred method:', [
              ...methods.map(m => ({
                text: m,
                onPress: async () => {
                  const key = m.toLowerCase().replace(/[^a-z]/g, '_');
                  setPrayerMethod(key);
                  await AsyncStorage.setItem(PRAYER_METHOD_KEY, key).catch(() => {});
                },
              })),
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="compass-outline" size={20} color={COLORS.primary} />
              <View>
                <Text style={styles.linkText}>Prayer Calculation Method</Text>
                <Text style={styles.linkSubtext}>{prayerMethod.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => {
            Alert.alert('Madhab', 'Select preferred madhab:', [
              { text: 'Hanafi', onPress: async () => { setPrayerMadhab('hanafi'); await AsyncStorage.setItem(PRAYER_MADHAB_KEY, 'hanafi'); } },
              { text: 'Shafi', onPress: async () => { setPrayerMadhab('shafi'); await AsyncStorage.setItem(PRAYER_MADHAB_KEY, 'shafi'); } },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="library-outline" size={20} color={COLORS.primary} />
              <View>
                <Text style={styles.linkText}>Madhab</Text>
                <Text style={styles.linkSubtext}>{prayerMadhab.charAt(0).toUpperCase() + prayerMadhab.slice(1)}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Azan Sound</Text>
            <Switch value={azanSound} onValueChange={(v) => toggleBooleanPref(AZAN_SOUND_KEY, v, setAzanSound)} trackColor={{ true: COLORS.primary }} />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Prayer Notifications</Text>
            <Switch value={prayerNotifications} onValueChange={(v) => toggleBooleanPref(PRAYER_NOTIF_KEY, v, setPrayerNotifications)} trackColor={{ true: COLORS.primary }} />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Friday Reminder</Text>
            <Switch value={fridayReminder} onValueChange={(v) => toggleBooleanPref(FRIDAY_REMINDER_KEY, v, setFridayReminder)} trackColor={{ true: COLORS.primary }} />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Islamic Reminders</Text>
            <Switch value={islamicReminders} onValueChange={(v) => toggleBooleanPref(ISLAMIC_REMINDERS_KEY, v, setIslamicReminders)} trackColor={{ true: COLORS.primary }} />
          </View>
          <TouchableOpacity style={styles.linkRow} onPress={() => {
            Alert.alert('Reminder Time', 'Select daily reminder time:', [
              { text: '09:00 AM', onPress: async () => { setReminderTime('09:00 AM'); await AsyncStorage.setItem(ISLAMIC_REMINDER_TIME_KEY, '09:00 AM'); } },
              { text: '12:00 PM', onPress: async () => { setReminderTime('12:00 PM'); await AsyncStorage.setItem(ISLAMIC_REMINDER_TIME_KEY, '12:00 PM'); } },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />
              <View>
                <Text style={styles.linkText}>Islamic Reminder Time</Text>
                <Text style={styles.linkSubtext}>{reminderTime}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </SettingsSection>

        {/* Section 4: Learning Preferences */}
        <SettingsSection title="Learning Preferences" icon="book-outline" defaultOpen={false}>
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.rowLabel}>Auto Resume Last Lesson</Text>
              <Text style={styles.rowSubtext}>Continue where you left off</Text>
            </View>
            <Switch value={autoResume} onValueChange={(v) => toggleBooleanPref(AUTO_RESUME_KEY, v, setAutoResume)} trackColor={{ true: COLORS.primary }} />
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.rowLabel}>Auto Play Lesson Recordings</Text>
              <Text style={styles.rowSubtext}>Play next audio/video automatically</Text>
            </View>
            <Switch value={autoPlay} onValueChange={(v) => toggleBooleanPref(AUTO_PLAY_KEY, v, setAutoPlay)} trackColor={{ true: COLORS.primary }} />
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.rowLabel}>Download on Wi-Fi Only</Text>
              <Text style={styles.rowSubtext}>Save mobile data bandwidth</Text>
            </View>
            <Switch value={wifiOnly} onValueChange={(v) => toggleBooleanPref(WIFI_ONLY_KEY, v, setWifiOnly)} trackColor={{ true: COLORS.primary }} />
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.rowLabel}>Remember PDF Reading Position</Text>
              <Text style={styles.rowSubtext}>Open course books at exact page</Text>
            </View>
            <Switch value={rememberPdf} onValueChange={(v) => toggleBooleanPref(REMEMBER_PDF_KEY, v, setRememberPdf)} trackColor={{ true: COLORS.primary }} />
          </View>
        </SettingsSection>

        {/* Section 5: Privacy & Security */}
        <SettingsSection title="Privacy & Security" icon="shield-checkmark-outline" defaultOpen={false}>
          <TouchableOpacity style={styles.linkRow} onPress={() => {
            if (appLockEnabled) {
              setPinStep('enter');
              setInputPin('');
              setPinModalVisible(true);
            } else {
              setPinStep('create');
              setInputPin('');
              setConfirmPin('');
              setPinModalVisible(true);
            }
          }}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.primary} />
              <View>
                <Text style={styles.linkText}>App Lock (PIN/Biometrics)</Text>
                <Text style={styles.linkSubtext}>{appLockEnabled ? 'Enabled (Security PIN Active)' : 'Disabled'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {appLockEnabled && <Ionicons name="checkmark-circle" size={18} color="#16A34A" />}
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>
          
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.rowLabel}>Hide Sensitive Information</Text>
              <Text style={styles.rowSubtext}>Mask emails and phone numbers on screen</Text>
            </View>
            <Switch value={hideSensitive} onValueChange={(v) => toggleBooleanPref(HIDE_SENSITIVE_KEY, v, setHideSensitive)} trackColor={{ true: COLORS.primary }} />
          </View>

          <TouchableOpacity style={styles.linkRow} onPress={handleClearCache}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="trash-bin-outline" size={20} color={COLORS.primary} />
              <Text style={styles.linkText}>Clear App Cache</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/data-privacy')}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="download-outline" size={20} color={COLORS.primary} />
              <Text style={styles.linkText}>Data Export / Deletion Requests</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </SettingsSection>

        {/* Section 6: Language */}
        <SettingsSection title="Language / زبان / اللغة" icon="language-outline" defaultOpen={false}>
          <TouchableOpacity style={styles.linkRow} onPress={() => setLangModalVisible(true)}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="earth-outline" size={20} color={COLORS.primary} />
              <View>
                <Text style={styles.linkText}>App Language (ایپ کی زبان)</Text>
                <Text style={styles.linkSubtext}>{languageName}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.badge, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
                <Text style={[styles.badgeText, { color: '#0369A1' }]}>{language.toUpperCase()}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>
        </SettingsSection>

        {/* Section 7: Support */}
        <SettingsSection title="Support" icon="help-buoy-outline" defaultOpen={false}>
          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(WHATSAPP_HELP_URL)}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
              <Text style={styles.linkText}>WhatsApp Support</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('mailto:madrastussalikatlilbanat@gmail.com?subject=MSDL%20App%20Support')}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="mail-outline" size={20} color="#0369A1" />
              <Text style={styles.linkText}>Email Support</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => setBugModalVisible(true)}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="bug-outline" size={20} color="#EF4444" />
              <Text style={styles.linkText}>Report a Bug (तकनीकी समस्या)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => setFeatureModalVisible(true)}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
              <Text style={styles.linkText}>Suggest a Feature (सुझाव भेजें)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => setFaqModalVisible(true)}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="chatbubbles-outline" size={20} color={COLORS.primary} />
              <Text style={styles.linkText}>FAQ (अक्सर पूछे जाने वाले सवाल)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </SettingsSection>

        {/* Section: Admin Diagnostics (Admin Only) */}
        {profile?.role === 'admin' && (
          <SettingsSection title="Developer & Diagnostics" icon="construct-outline" defaultOpen={false}>
            <AdminHealthDashboard 
              onClearCache={() => {
                Alert.alert('Clear Local Cache', 'Are you sure you want to clear local cached data?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('Success', 'Cache cleared.') }
                ]);
              }}
              onSyncData={() => Alert.alert('Sync Data', 'Local cache refreshed from Firestore.')}
              onOpenLogs={() => setDiagLogsVisible(true)}
              checkDiagnosticsParent={checkDiagnostics}
            />
          </SettingsSection>
        )}

        {/* Section 8: About */}
        <SettingsSection title="About" icon="information-circle-outline" defaultOpen={false}>
          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(MADRASA_WEBSITE_URL)}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="globe-outline" size={20} color="#0FA958" />
              <View>
                <Text style={styles.linkText}>Official Website</Text>
                <Text style={styles.linkSubtext}>{MADRASA_WEBSITE_DISPLAY}</Text>
              </View>
            </View>
            <Ionicons name="open-outline" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/terms')}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              <Text style={styles.linkText}>Privacy Policy & Terms</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View style={styles.aboutCard}>
            <Text style={styles.aboutTitle}>Madrasa Tus Salikat Lil Banat</Text>
            <Text style={styles.aboutText}>App Version: {Constants.expoConfig?.version || '1.0.0'}</Text>
            <Text style={styles.aboutText}>Build Number: {Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1'}</Text>
            <View style={styles.aboutDivider} />
            <Text style={styles.aboutSubText}>Developed with ❤️ for Islamic Education</Text>
            <Text style={styles.aboutSubText}>Open Source Licenses available internally.</Text>
          </View>
        </SettingsSection>
      </ScrollView>
      <Modal visible={diagLogsVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDiagLogsVisible(false)}>
        <View style={styles.container}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setDiagLogsVisible(false)}>
              <Ionicons name="close" size={22} color={COLORS.textMain} />
            </TouchableOpacity>
            <Text style={styles.title}>Diagnostics Logs</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.textMuted} style={{ marginBottom: 16 }} />
            <Text style={{ color: COLORS.textMuted, fontSize: 16, fontWeight: '500' }}>No diagnostic logs available.</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={themeModalVisible} animationType="fade" transparent onRequestClose={() => setThemeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.langModalContent}>
            <View style={styles.langModalHeader}>
              <Text style={styles.langModalTitle}>Select App Theme</Text>
              <TouchableOpacity onPress={() => setThemeModalVisible(false)} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMain} />
              </TouchableOpacity>
            </View>
            <Text style={styles.langModalSub}>Choose your preferred appearance mode:</Text>
            {(['System Default', 'Light Mode', 'Dark Mode'] as const).map((tOpt) => {
              const isSelected = theme === tOpt;
              return (
                <TouchableOpacity
                  key={tOpt}
                  style={[styles.langOptionCard, isSelected && styles.langOptionCardSelected]}
                  onPress={async () => {
                    setTheme(tOpt);
                    void setThemeMode(tOpt);
                    await AsyncStorage.setItem(THEME_PREF_KEY, tOpt);
                    setThemeModalVisible(false);
                    Alert.alert('Theme Updated', `App theme set to ${tOpt}.`);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.langOptionLeft}>
                    <View style={[styles.langRadio, isSelected && styles.langRadioSelected]}>
                      {isSelected && <View style={styles.langRadioInner} />}
                    </View>
                    <Text style={[styles.langOptionTitle, isSelected && { color: COLORS.primary, fontWeight: '700' }]}>{tOpt}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal visible={fontSizeModalVisible} animationType="fade" transparent onRequestClose={() => setFontSizeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.langModalContent}>
            <View style={styles.langModalHeader}>
              <Text style={styles.langModalTitle}>Select Font Size</Text>
              <TouchableOpacity onPress={() => setFontSizeModalVisible(false)} style={styles.iconBtn}>
                <Ionicons name="close" size={22} color={COLORS.textMain} />
              </TouchableOpacity>
            </View>
            <Text style={styles.langModalSub}>Adjust reading text size across the application:</Text>
            {(['Small', 'Medium', 'Large', 'Extra Large'] as const).map((fsOpt) => {
              const isSelected = fontSize === fsOpt;
              return (
                <TouchableOpacity
                  key={fsOpt}
                  style={[styles.langOptionCard, isSelected && styles.langOptionCardSelected]}
                  onPress={async () => {
                    setFontSize(fsOpt);
                    void setFontSizeScale(fsOpt);
                    await AsyncStorage.setItem(FONT_SIZE_PREF_KEY, fsOpt);
                    setFontSizeModalVisible(false);
                    Alert.alert('Font Size Updated', `Reading font size set to ${fsOpt}.`);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.langOptionLeft}>
                    <View style={[styles.langRadio, isSelected && styles.langRadioSelected]}>
                      {isSelected && <View style={styles.langRadioInner} />}
                    </View>
                    <Text style={[styles.langOptionTitle, isSelected && { color: COLORS.primary, fontWeight: '700' }]}>{fsOpt}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal visible={pinModalVisible} animationType="fade" transparent onRequestClose={() => setPinModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.langModalContent, { alignItems: 'center', paddingVertical: SPACING.xl }]}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="lock-closed" size={24} color={COLORS.primary} />
            </View>
            <Text style={[styles.langModalTitle, { marginTop: SPACING.md, textAlign: 'center' }]}>
              {pinStep === 'enter' ? 'Enter Security PIN to Disable' : pinStep === 'create' ? 'Create a 4-Digit PIN' : 'Confirm 4-Digit PIN'}
            </Text>
            <Text style={[styles.langModalSub, { textAlign: 'center', marginBottom: SPACING.lg }]}>
              {pinStep === 'enter' ? 'Enter your existing security PIN to disable App Lock.' : pinStep === 'create' ? 'Set up a 4-digit PIN to secure your Madrasa app.' : 'Re-enter your PIN to confirm setup.'}
            </Text>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: SPACING.xl }}>
              {[0, 1, 2, 3].map((idx) => {
                const char = inputPin[idx] || '';
                return (
                  <View key={idx} style={[styles.langOptionCard, { width: 56, height: 64, justifyContent: 'center', alignItems: 'center', padding: 0 }]}>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: COLORS.primary }}>{char ? '•' : ''}</Text>
                  </View>
                );
              })}
            </View>

            {/* Numeric Keypad */}
            <View style={{ width: '100%', maxWidth: 280, gap: 12 }}>
              {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['Cancel', '0', '⌫']].map((row, rIdx) => (
                <View key={rIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  {row.map((btn, bIdx) => (
                    <TouchableOpacity
                      key={bIdx}
                      style={[styles.langOptionCard, { flex: 1, height: 52, justifyContent: 'center', alignItems: 'center', padding: 0, backgroundColor: btn === 'Cancel' || btn === '⌫' ? '#F1F5F9' : '#FFFFFF' }]}
                      onPress={async () => {
                        if (btn === 'Cancel') {
                          setPinModalVisible(false);
                          setInputPin('');
                        } else if (btn === '⌫') {
                          setInputPin((prev) => prev.slice(0, -1));
                        } else {
                          const nextPin = inputPin + btn;
                          if (nextPin.length <= 4) {
                            setInputPin(nextPin);
                            if (nextPin.length === 4) {
                              if (pinStep === 'enter') {
                                if (nextPin === appPin) {
                                  setAppLockEnabled(false);
                                  await AsyncStorage.setItem(APP_LOCK_KEY, 'false');
                                  setPinModalVisible(false);
                                  Alert.alert('App Lock Disabled', 'Security PIN has been removed.');
                                } else {
                                  Alert.alert('Incorrect PIN', 'Please try again.');
                                  setInputPin('');
                                }
                              } else if (pinStep === 'create') {
                                setConfirmPin(nextPin);
                                setPinStep('confirm');
                                setInputPin('');
                              } else if (pinStep === 'confirm') {
                                if (nextPin === confirmPin) {
                                  setAppPin(nextPin);
                                  setAppLockEnabled(true);
                                  await AsyncStorage.setItem(APP_PIN_KEY, nextPin);
                                  await AsyncStorage.setItem(APP_LOCK_KEY, 'true');
                                  setPinModalVisible(false);
                                  Alert.alert('App Lock Enabled', 'Your 4-digit PIN is set! App is now secured.');
                                } else {
                                  Alert.alert('PIN Mismatch', 'The PINs did not match. Let\'s try again.');
                                  setPinStep('create');
                                  setInputPin('');
                                }
                              }
                            }
                          }
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: btn === 'Cancel' || btn === '⌫' ? 15 : 22, fontWeight: '700', color: btn === 'Cancel' ? '#EF4444' : COLORS.textMain }}>{btn}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <BugReportModal visible={bugModalVisible} onClose={() => setBugModalVisible(false)} />
      <FeatureSuggestModal visible={featureModalVisible} onClose={() => setFeatureModalVisible(false)} />
      <FaqModal visible={faqModalVisible} onClose={() => setFaqModalVisible(false)} />
      <LanguageSwitcherSheet visible={langModalVisible} onClose={() => setLangModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: '#FFFFFF',
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  scrollContent: { paddingBottom: SPACING.xxl + 40, paddingTop: SPACING.md },
  
  section: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    ...SHADOWS.card,
    shadowOpacity: 0.05,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionIconCircle: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', letterSpacing: 0.2 },
  sectionContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: 16,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  rowLabel: { fontSize: 15, color: '#334155', fontWeight: '600' },
  rowSubtext: { fontSize: 13, color: '#64748B', marginTop: 2 },
  
  channelGrid: { gap: 12 },
  
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    minHeight: 48,
  },
  linkRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  linkText: { fontSize: 15, color: '#334155', fontWeight: '600' },
  linkSubtext: { fontSize: 13, color: '#64748B', fontWeight: '400', marginTop: 2 },
  disabledRow: {
    opacity: 0.7,
  },
  
  badge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },

  actionButton: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  actionButtonText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 14,
  },

  aboutCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  aboutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 12,
  },
  aboutSubText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  langModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  langModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  langModalTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 18,
    color: COLORS.textMain,
  },
  langModalSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  langOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: SPACING.sm,
    backgroundColor: '#F8FAFC',
  },
  langOptionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDF4',
  },
  langOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  langRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langRadioSelected: {
    borderColor: COLORS.primary,
  },
  langRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  langOptionTitle: {
    fontSize: 15,
    color: COLORS.textMain,
    fontWeight: '600',
  },
  langOptionDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
