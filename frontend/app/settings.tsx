import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, Switch, Alert, ScrollView,
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

const NOTIFICATION_PREF_KEY = 'settings_notifications_enabled';
const LARGE_TEXT_PREF_KEY = 'settings_large_text';
const PRAYER_METHOD_KEY = 'settings_prayer_method';
const PRAYER_NOTIF_KEY = 'settings_prayer_notifications';
const ISLAMIC_REMINDERS_KEY = 'settings_islamic_reminders';

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
            <Ionicons name={icon} size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [largeText, setLargeText] = useState(false);
  const [prayerMethod, setPrayerMethod] = useState('umm_al_qura');
  const [prayerNotifications, setPrayerNotifications] = useState(true);
  const [islamicReminders, setIslamicReminders] = useState(true);
  const [channelPrefs, setChannelPrefs] = useState<Record<NotificationChannel, boolean>>({
    chat: true, story: true, live_class: true, calls: true, assignments: true, announcements: true, attendance: true, admin: true,
  });

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const [notif, large, method, prayerNotif, reminders] = await Promise.all([
          AsyncStorage.getItem(NOTIFICATION_PREF_KEY),
          AsyncStorage.getItem(LARGE_TEXT_PREF_KEY),
          AsyncStorage.getItem(PRAYER_METHOD_KEY),
          AsyncStorage.getItem(PRAYER_NOTIF_KEY),
          AsyncStorage.getItem(ISLAMIC_REMINDERS_KEY),
        ]);
        setNotificationsEnabled(notif !== 'false');
        setLargeText(large === 'true');
        if (method) setPrayerMethod(method);
        setPrayerNotifications(prayerNotif !== 'false');
        setIslamicReminders(reminders !== 'false');
      } catch {
        // ignore preference loading failure
      }
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

  const toggleLargeText = async (value: boolean) => {
    setLargeText(value);
    await AsyncStorage.setItem(LARGE_TEXT_PREF_KEY, value ? 'true' : 'false').catch(() => {});
  };

  const togglePrayerNotifications = async (value: boolean) => {
    setPrayerNotifications(value);
    await AsyncStorage.setItem(PRAYER_NOTIF_KEY, value ? 'true' : 'false').catch(() => {});
  };

  const toggleIslamicReminders = async (value: boolean) => {
    setIslamicReminders(value);
    await AsyncStorage.setItem(ISLAMIC_REMINDERS_KEY, value ? 'true' : 'false').catch(() => {});
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBackOrReplace(router, '/more')}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Notifications Section */}
        <SettingsSection title="Notifications" icon="notifications-outline">
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Enable notifications</Text>
            <Switch value={notificationsEnabled} onValueChange={toggleNotifications} trackColor={{ true: COLORS.primary }} />
          </View>
          <View style={styles.channelGrid}>
            <View style={styles.row}><Text style={styles.rowLabel}>Chat</Text><Switch value={channelPrefs.chat} onValueChange={(v) => toggleChannel('chat', v)} trackColor={{ true: COLORS.primary }} /></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Live classes</Text><Switch value={channelPrefs.live_class} onValueChange={(v) => toggleChannel('live_class', v)} trackColor={{ true: COLORS.primary }} /></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Stories</Text><Switch value={channelPrefs.story} onValueChange={(v) => toggleChannel('story', v)} trackColor={{ true: COLORS.primary }} /></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Calls</Text><Switch value={channelPrefs.calls} onValueChange={(v) => toggleChannel('calls', v)} trackColor={{ true: COLORS.primary }} /></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Assignments</Text><Switch value={channelPrefs.assignments} onValueChange={(v) => toggleChannel('assignments', v)} trackColor={{ true: COLORS.primary }} /></View>
            <View style={styles.row}><Text style={styles.rowLabel}>Announcements</Text><Switch value={channelPrefs.announcements} onValueChange={(v) => toggleChannel('announcements', v)} trackColor={{ true: COLORS.primary }} /></View>
          </View>
        </SettingsSection>

        {/* Appearance Section */}
        <SettingsSection title="Appearance" icon="color-palette-outline">
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Large text mode</Text>
            <Switch value={largeText} onValueChange={toggleLargeText} trackColor={{ true: COLORS.primary }} />
          </View>
          <TouchableOpacity style={styles.linkRow} onPress={() => {
            setCurrentStep('dashboard');
            setShowTutorial(true);
          }}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="play-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.linkText}>Replay tutorial</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </SettingsSection>

        {/* Islamic Features Section */}
        <SettingsSection title="Islamic Features" icon="moon-outline">
          <TouchableOpacity style={styles.linkRow} onPress={() => {
            const methods = ['Umm al-Qura', 'Muslim World League', 'ISNA', 'Egyptian General Authority'];
            const currentIdx = Math.max(0, methods.findIndex(m => m.toLowerCase().replace(/[^a-z]/g, '_').includes(prayerMethod.replace('umm_al_qura', 'umm'))));
            Alert.alert('Prayer Calculation Method', 'Select your preferred method:', [
              ...methods.map(m => ({
                text: m,
                onPress: async () => {
                  const key = m.toLowerCase().replace(/[^a-z]/g, '_');
                  setPrayerMethod(key);
                  await AsyncStorage.setItem(PRAYER_METHOD_KEY, key).catch(() => {});
                },
              })),
              { text: 'Cancel', style: 'cancel' as const },
            ]);
          }}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="compass-outline" size={18} color={COLORS.primary} />
              <View>
                <Text style={styles.linkText}>Prayer Calculation Method</Text>
                <Text style={styles.linkSubtext}>{prayerMethod.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Prayer notifications</Text>
            <Switch value={prayerNotifications} onValueChange={togglePrayerNotifications} trackColor={{ true: COLORS.primary }} />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Islamic reminders</Text>
            <Switch value={islamicReminders} onValueChange={toggleIslamicReminders} trackColor={{ true: COLORS.primary }} />
          </View>
        </SettingsSection>

        {/* Account Section */}
        <SettingsSection title="Account" icon="person-outline">
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/about')}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
              <Text style={styles.linkText}>Edit profile details</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/data-privacy')}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
              <Text style={styles.linkText}>Data export / deletion requests</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/terms')}>
            <View style={styles.linkRowLeft}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
              <Text style={styles.linkText}>Terms and policy versions</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </SettingsSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  scrollContent: { paddingBottom: SPACING.xxl },
  section: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    ...SHADOWS.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  sectionContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rowLabel: { fontSize: 13, color: COLORS.textMain, fontWeight: '500' },
  channelGrid: { gap: 4, marginTop: 4 },
  linkRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  linkText: { fontSize: 13, color: COLORS.textMain, fontWeight: '600' },
  linkSubtext: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 1 },
});
