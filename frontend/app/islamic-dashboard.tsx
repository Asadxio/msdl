import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IslamicDashboardWidget from '@/components/IslamicDashboardWidget';
import { ScalePressable } from '@/components/ui';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { goBackOrReplace } from '@/lib/navigation';

const DASHBOARD_ACTIONS = [
  { label: 'Dar-ul-Iftaa (Fatwa Library)', subtitle: 'Private Islamic questions & official fatwa library', icon: 'ribbon-outline' as const, route: '/fatawa' },
  { label: 'Islamic Calendar', subtitle: 'Open the Hijri calendar view', icon: 'calendar-number-outline' as const, route: '/islamic-calendar' },
  { label: 'Prayer Times', subtitle: 'View daily prayer schedule', icon: 'time-outline' as const, route: '/prayer-times' },
  { label: 'Qibla Finder', subtitle: 'Find direction to the Kaaba', icon: 'compass-outline' as const, route: '/qibla' },
];

export default function IslamicDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.sm }]} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => goBackOrReplace(router, '/more')} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Applications</Text>
          <Text style={styles.title}>Islamic Dashboard</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Complete dashboard</Text>
        <Text style={styles.heroTitle}>Prayer, Hijri date, location, and Qibla tools in one place.</Text>
        <Text style={styles.heroText}>The Home screen keeps a compact snapshot. This Applications screen is the full Islamic Dashboard entry point.</Text>
      </View>

      <IslamicDashboardWidget />

      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Related Applications</Text>
        {DASHBOARD_ACTIONS.map((item) => (
          <ScalePressable key={item.route} style={styles.actionCard} onPress={() => router.push(item.route as any)}>
            <View style={styles.actionIcon}>
              <Ionicons name={item.icon} size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{item.label}</Text>
              <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
            </View>
            <View style={styles.chevronBubble}>
              <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
            </View>
          </ScalePressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  backButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F2E7C8',
    ...SHADOWS.card,
  },
  eyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.1 },
  title: { ...TYPOGRAPHY.title, color: COLORS.text, letterSpacing: -0.6 },
  heroCard: {
    borderRadius: 28,
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6B85A',
    shadowColor: '#0F3D35',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 4,
  },
  heroEyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  heroTitle: { color: COLORS.text, fontSize: 20, fontWeight: '900', lineHeight: 27, marginTop: 6, letterSpacing: -0.4 },
  heroText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700', lineHeight: 20, marginTop: 8 },
  actionsSection: { marginTop: SPACING.lg, gap: SPACING.sm },
  sectionTitle: { ...TYPOGRAPHY.heading, color: COLORS.text, fontSize: 20, marginBottom: 2 },
  actionCard: {
    minHeight: 78,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: '#F2E7C8',
    shadowColor: '#0F3D35',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  actionIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: '#FFF8E6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1DFA7' },
  actionTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  actionSubtitle: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 3 },
  chevronBubble: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EFFAF5', alignItems: 'center', justifyContent: 'center' },
});
