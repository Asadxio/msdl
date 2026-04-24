import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, Switch, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

const NOTIFICATION_PREF_KEY = 'settings_notifications_enabled';
const LARGE_TEXT_PREF_KEY = 'settings_large_text';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [largeText, setLargeText] = useState(false);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const [notif, large] = await Promise.all([
          AsyncStorage.getItem(NOTIFICATION_PREF_KEY),
          AsyncStorage.getItem(LARGE_TEXT_PREF_KEY),
        ]);
        setNotificationsEnabled(notif !== 'false');
        setLargeText(large === 'true');
      } catch {
        // ignore preference loading failure
      }
    };
    loadPrefs().catch(() => {});
  }, []);

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem(NOTIFICATION_PREF_KEY, value ? 'true' : 'false').catch(() => {});
  };

  const toggleLargeText = async (value: boolean) => {
    setLargeText(value);
    await AsyncStorage.setItem(LARGE_TEXT_PREF_KEY, value ? 'true' : 'false').catch(() => {});
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Enable notifications</Text>
          <Switch value={notificationsEnabled} onValueChange={toggleNotifications} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Settings</Text>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/about')}>
          <Text style={styles.linkText}>Edit profile details</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Preferences</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Large text mode</Text>
          <Switch value={largeText} onValueChange={toggleLargeText} />
        </View>
        <TouchableOpacity style={styles.linkRow} onPress={() => Alert.alert('Saved', 'Preferences are saved on this device.')}>
          <Text style={styles.linkText}>Save preferences</Text>
          <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  section: {
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    ...SHADOWS.card,
    gap: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 13, color: COLORS.textMain, fontWeight: '500' },
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
  linkText: { fontSize: 13, color: COLORS.textMain, fontWeight: '600' },
});
