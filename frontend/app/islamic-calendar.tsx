import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';

const HIJRI_MONTH_NORMALIZATION: Record<string, string> = {
  "Dhuʻl-Qiʻdah": 'Zul Qidah',
  'Dhu’l-Qi’dah': 'Zul Qidah',
  "Dhuʻl-Hijjah": 'Zul Hijjah',
  'Dhu’l-Hijjah': 'Zul Hijjah',
  'Dhu al-Hijjah': 'Zul Hijjah',
  'Rabiʻ I': 'Rabi al-Awwal',
  'Rabi’ I': 'Rabi al-Awwal',
  'Rabiʻ II': 'Rabi al-Thani',
  'Rabi’ II': 'Rabi al-Thani',
};

function formatHijri(date: Date) {
  const raw = new Intl.DateTimeFormat('en-TN-u-ca-islamic', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return Object.entries(HIJRI_MONTH_NORMALIZATION).reduce((value, [from, to]) => value.replace(from, to), raw);
}

function formatUrduHijri(date: Date) {
  return new Intl.DateTimeFormat('ur-PK-u-ca-islamic', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function IslamicCalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), []);
  const hijri = formatHijri(now);
  const urduHijri = formatUrduHijri(now);
  const english = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.md }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Applications</Text>
          <Text style={styles.title}>Islamic Calendar</Text>
        </View>
      </View>

      <View style={styles.heroCard} testID="islamic-calendar-screen">
        <Ionicons name="calendar-number-outline" size={42} color={COLORS.secondary} />
        <Text style={styles.heroLabel}>Hijri Date</Text>
        <Text style={styles.hijriText}>{hijri}</Text>
        <Text style={styles.urduText}>{urduHijri}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Gregorian Date</Text>
        <Text style={styles.infoValue}>{english}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Moved from dashboard</Text>
        <Text style={styles.infoBody}>The full Islamic Calendar now lives under More → Applications to keep the home dashboard compact and focused on today’s prayer snapshot.</Text>
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
  heroCard: { backgroundColor: COLORS.primary, borderRadius: 28, padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm, ...SHADOWS.card },
  heroLabel: { color: 'rgba(255,255,255,0.74)', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  hijriText: { color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  urduText: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  infoCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card },
  infoLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 4 },
  infoBody: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600', lineHeight: 20, marginTop: 4 },
});
