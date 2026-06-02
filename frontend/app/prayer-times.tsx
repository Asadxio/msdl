import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';

type PrayerTime = { name: string; hour: number; minute: number };

const PRAYERS: PrayerTime[] = [
  { name: 'Fajr', hour: 5, minute: 0 },
  { name: 'Sunrise', hour: 6, minute: 20 },
  { name: 'Zuhr', hour: 13, minute: 0 },
  { name: 'Asr', hour: 16, minute: 30 },
  { name: 'Maghrib', hour: 19, minute: 0 },
  { name: 'Isha', hour: 20, minute: 30 },
];

function atToday(hour: number, minute: number) {
  const value = new Date();
  value.setHours(hour, minute, 0, 0);
  return value;
}

function label(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function PrayerTimesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prayers = useMemo(() => PRAYERS.map((prayer) => ({ ...prayer, time: atToday(prayer.hour, prayer.minute) })), []);
  const now = new Date();
  const next = prayers.find((prayer) => prayer.time.getTime() > now.getTime()) ?? prayers[0];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.md }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Applications</Text>
          <Text style={styles.title}>Prayer Times</Text>
        </View>
      </View>

      <View style={styles.heroCard} testID="prayer-times-screen">
        <Text style={styles.heroLabel}>Next Prayer</Text>
        <Text style={styles.heroTitle}>{next.name}</Text>
        <Text style={styles.heroSubtitle}>{label(next.time)}</Text>
      </View>

      <View style={styles.list}>
        {prayers.map((prayer) => (
          <View key={prayer.name} style={[styles.row, prayer.name === next.name && styles.rowActive]}>
            <Text style={[styles.name, prayer.name === next.name && styles.nameActive]}>{prayer.name}</Text>
            <Text style={[styles.time, prayer.name === next.name && styles.timeActive]}>{label(prayer.time)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  heroCard: { backgroundColor: COLORS.primary, borderRadius: 28, padding: SPACING.xl, alignItems: 'center', ...SHADOWS.card },
  heroLabel: { color: 'rgba(255,255,255,0.74)', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 4 },
  heroSubtitle: { color: COLORS.secondary, fontSize: 18, fontWeight: '900', marginTop: 4 },
  list: { gap: SPACING.sm },
  row: { borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, padding: SPACING.md, flexDirection: 'row', justifyContent: 'space-between', ...SHADOWS.card },
  rowActive: { backgroundColor: COLORS.goldBg, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' },
  name: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  nameActive: { color: COLORS.primary },
  time: { color: COLORS.textMuted, fontSize: 15, fontWeight: '800' },
  timeActive: { color: COLORS.primary },
});
