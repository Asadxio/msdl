import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IslamicDashboardWidget from '@/components/IslamicDashboardWidget';
import { ScalePressable } from '@/components/ui';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { goBackOrReplace } from '@/lib/navigation';

type AppItem = { label: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; route?: string; disabled?: boolean; featured?: boolean };

const APPLICATION_ITEMS: AppItem[] = [
  { label: 'Islamic Dashboard', subtitle: 'Complete prayer, Hijri, location, and Qibla overview', icon: 'grid-outline', route: '/more/applications/islamic-dashboard', featured: true },
  { label: 'Islamic Calendar', subtitle: 'Hijri date and Islamic calendar view', icon: 'calendar-number-outline', route: '/islamic-calendar' },
  { label: 'Qibla Finder', subtitle: 'Google Camera Qibla Finder (Internet Required) and Compass Qibla Direction', icon: 'compass-outline', route: '/qibla' },
  { label: 'Prayer Times', subtitle: 'Daily prayer schedule and countdown', icon: 'time-outline', route: '/prayer-times' },
  { label: 'Future Islamic Tools', subtitle: 'Duas, tasbih, and more tools coming soon', icon: 'sparkles-outline', disabled: true },
];

export default function ApplicationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.sm }]} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <ScalePressable style={styles.backButton} onPress={() => goBackOrReplace(router, '/more')} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </ScalePressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>More → Applications</Text>
          <Text style={styles.title}>Applications</Text>
        </View>
      </View>

      <View style={styles.appsSection}>
        <Text style={styles.appsEyebrow}>More → Applications</Text>
        <Text style={styles.appsTitle}>Applications</Text>
        <View style={styles.appsGrid}>
          {APPLICATION_ITEMS.map((item) => (
            <ScalePressable
              key={item.label}
              style={[styles.appCard, item.featured && styles.appCardFeatured, item.disabled && styles.appCardDisabled]}
              onPress={() => item.route && router.push(item.route as any)}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}. ${item.subtitle}`}
              accessibilityState={{ disabled: item.disabled }}
              disabled={item.disabled}
            >
              <View style={[styles.appIcon, item.featured && styles.appIconFeatured]}>
                <Ionicons name={item.icon} size={24} color={item.featured ? '#fff' : COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.appTitle}>{item.label}</Text>
                <Text style={styles.appSubtitle}>{item.subtitle}</Text>
              </View>
              {item.disabled ? (
                <Text style={styles.comingSoon}>Soon</Text>
              ) : (
                <View style={styles.chevronBubble}>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
                </View>
              )}
            </ScalePressable>
          ))}
        </View>
      </View>

      {isAdmin ? null : null}

      <View style={styles.grid}>
        {/* Placeholder for future additional actions if needed. */}
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
  appsSection: { marginBottom: SPACING.lg, borderRadius: 28, padding: SPACING.md, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3E6BE', ...SHADOWS.card },
  appsEyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.1 },
  appsTitle: { ...TYPOGRAPHY.heading, color: COLORS.textMain, fontSize: 23, marginTop: 4, marginBottom: SPACING.md, letterSpacing: -0.4 },
  appsGrid: { gap: SPACING.sm },
  appCard: {
    minHeight: 92,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: '#F2E7C8',
    shadowColor: '#0F3D35',
    shadowOpacity: 0.11,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 4,
  },
  appCardFeatured: { borderColor: '#D6B85A', backgroundColor: '#FFFCF4' },
  appCardDisabled: { opacity: 0.62 },
  appIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1DFA7',
  },
  appIconFeatured: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  appTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  appSubtitle: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', marginTop: 4, lineHeight: 17 },
  comingSoon: { color: COLORS.secondary, fontSize: 12, fontWeight: '900' },
  chevronBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { gap: SPACING.sm },
});
