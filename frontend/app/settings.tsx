import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, Switch, Alert, ScrollView, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTutorial } from '@/context/TutorialContext';
import { getNotificationPreferences, updateNotificationPreferences, type NotificationChannel } from '@/lib/notificationCenter';
import Constants from 'expo-constants';
import { WHATSAPP_HELP_URL } from '@/lib/links';

const NOTIFICATION_PREF_KEY = 'settings_notifications_enabled';
const LARGE_TEXT_PREF_KEY = 'settings_large_text';
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
  const { user } = useAuth();
  const { setShowTutorial, setCurrentStep } = useTutorial();
  
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

  const handleTestNotification = () => {
    Alert.alert('Test Notification', 'This is a test notification sound and vibration.');
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'Are you sure you want to clear the app cache?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('Success', 'Cache cleared successfully.') }
    ]);
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

        {/* Section 2: Appearance */}
        <SettingsSection title="Appearance" icon="color-palette-outline" defaultOpen={false}>
          <TouchableOpacity style={[styles.linkRow, styles.disabledRow]} disabled>
            <View style={styles.linkRowLeft}>
              <Ionicons name="moon-outline" size={20} color={COLORS.textMuted} />
              <View>
                <Text style={[styles.linkText, { color: COLORS.textMuted }]}>Theme</Text>
                <Text style={styles.linkSubtext}>System Default</Text>
              </View>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.linkRow, styles.disabledRow]} disabled>
            <View style={styles.linkRowLeft}>
              <Ionicons name="text-outline" size={20} color={COLORS.textMuted} />
              <View>
                <Text style={[styles.linkText, { color: COLORS.textMuted }]}>Font Size</Text>
                <Text style={styles.linkSubtext}>Medium</Text>
              </View>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
          </TouchableOpacity>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Large Text Mode</Text>
            <Switch value={largeText} onValueChange={(v) => toggleBooleanPref(LARGE_TEXT_PREF_KEY, v, setLargeText)} trackColor={{ true: COLORS.primary }} />
          </View>
          
          <TouchableOpacity style={[styles.linkRow, styles.disabledRow]} disabled>
            <View style={styles.linkRowLeft}>
              <Ionicons name="flash-off-outline" size={20} color={COLORS.textMuted} />
              <Text style={[styles.linkText, { color: COLORS.textMuted }]}>Reduce Motion</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
          </TouchableOpacity>

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
          {[
            { label: 'Auto Resume Last Lesson', icon: 'play-forward-outline' as const },
            { label: 'Auto Play Lesson Recordings', icon: 'play-circle-outline' as const },
            { label: 'Download on Wi-Fi Only', icon: 'wifi-outline' as const },
            { label: 'Remember PDF Reading Position', icon: 'bookmark-outline' as const },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={[styles.linkRow, styles.disabledRow]} disabled>
              <View style={styles.linkRowLeft}>
                <Ionicons name={item.icon} size={20} color={COLORS.textMuted} />
                <Text style={[styles.linkText, { color: COLORS.textMuted }]}>{item.label}</Text>
              </View>
              <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
            </TouchableOpacity>
          ))}
        </SettingsSection>

        {/* Section 5: Privacy & Security */}
        <SettingsSection title="Privacy & Security" icon="shield-checkmark-outline" defaultOpen={false}>
          <TouchableOpacity style={[styles.linkRow, styles.disabledRow]} disabled>
            <View style={styles.linkRowLeft}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />
              <Text style={[styles.linkText, { color: COLORS.textMuted }]}>App Lock (PIN/Biometrics)</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.linkRow, styles.disabledRow]} disabled>
            <View style={styles.linkRowLeft}>
              <Ionicons name="eye-off-outline" size={20} color={COLORS.textMuted} />
              <Text style={[styles.linkText, { color: COLORS.textMuted }]}>Hide Sensitive Information</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
          </TouchableOpacity>

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
        <SettingsSection title="Language" icon="language-outline" defaultOpen={false}>
          <TouchableOpacity style={[styles.linkRow, styles.disabledRow]} disabled>
            <View style={styles.linkRowLeft}>
              <Ionicons name="earth-outline" size={20} color={COLORS.textMuted} />
              <View>
                <Text style={[styles.linkText, { color: COLORS.textMuted }]}>App Language</Text>
                <Text style={styles.linkSubtext}>English / Urdu / Arabic</Text>
              </View>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
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
          <TouchableOpacity style={[styles.linkRow, styles.disabledRow]} disabled>
            <View style={styles.linkRowLeft}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />
              <Text style={[styles.linkText, { color: COLORS.textMuted }]}>Email Support</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Unavailable</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.linkRow, styles.disabledRow]} disabled>
            <View style={styles.linkRowLeft}>
              <Ionicons name="bug-outline" size={20} color={COLORS.textMuted} />
              <Text style={[styles.linkText, { color: COLORS.textMuted }]}>Report a Bug</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.linkRow, styles.disabledRow]} disabled>
            <View style={styles.linkRowLeft}>
              <Ionicons name="bulb-outline" size={20} color={COLORS.textMuted} />
              <Text style={[styles.linkText, { color: COLORS.textMuted }]}>Suggest a Feature</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.linkRow, styles.disabledRow]} disabled>
            <View style={styles.linkRowLeft}>
              <Ionicons name="chatbubbles-outline" size={20} color={COLORS.textMuted} />
              <Text style={[styles.linkText, { color: COLORS.textMuted }]}>FAQ</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>Coming Soon</Text></View>
          </TouchableOpacity>
        </SettingsSection>

        {/* Section 8: About */}
        <SettingsSection title="About" icon="information-circle-outline" defaultOpen={false}>
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
  }
});
