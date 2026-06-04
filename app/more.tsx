import React from 'react';
import { View, Text, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { ScalePressable } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

type MoreItem = { label: string; icon: keyof typeof Ionicons.glyphMap; route: string; adminOnly?: boolean };
type AppItem = { label: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; route?: string; disabled?: boolean; featured?: boolean };

const APPLICATION_ITEMS: AppItem[] = [
  { label: 'Islamic Dashboard', subtitle: 'Complete prayer, Hijri, location, and Qibla overview', icon: 'grid-outline', route: '/islamic-dashboard', featured: true },
  { label: 'Islamic Calendar', subtitle: 'Hijri date and Islamic calendar view', icon: 'calendar-number-outline', route: '/islamic-calendar' },
  { label: 'Qibla Finder', subtitle: 'Google Camera Qibla Finder (Internet Required) and Compass Qibla Direction', icon: 'compass-outline', route: '/qibla' },
  { label: 'Prayer Times', subtitle: 'Daily prayer schedule and countdown', icon: 'time-outline', route: '/prayer-times' },
  { label: 'Future Islamic Tools', subtitle: 'Duas, tasbih, and more tools coming soon', icon: 'sparkles-outline', disabled: true },
];

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const dark = colorScheme === 'dark';

  const MORE_ITEMS: MoreItem[] = [
    { label: 'Library', icon: 'library-outline', route: '/library' },
    { label: 'Attendance', icon: 'calendar-outline', route: '/attendance' },
    { label: 'Quiz', icon: 'help-circle-outline', route: '/quiz' },
    { label: 'Recordings', icon: 'play-circle-outline', route: '/recordings' },
    { label: 'Status', icon: 'radio-outline', route: '/status' },
    { label: 'Teachers', icon: 'people-outline', route: '/teachers' },
    { label: 'Settings', icon: 'settings-outline', route: '/settings' },
    { label: 'Privacy Policy', icon: 'shield-checkmark-outline', route: '/privacy' },
    { label: 'Terms & Conditions', icon: 'document-text-outline', route: '/terms' },
    { label: 'Community Guidelines', icon: 'people-outline', route: '/community-guidelines' },
    { label: 'Data & Privacy Controls', icon: 'lock-closed-outline', route: '/data-privacy' },
    { label: 'About & Donations', icon: 'heart-outline', route: '/payment' },
    { label: 'Manage Academics', icon: 'school-outline', route: '/admin/manage-academics', adminOnly: true },
    { label: 'Admin Payments', icon: 'card-outline', route: '/admin/payments', adminOnly: true },
    { label: 'Admin Users', icon: 'people-circle-outline', route: '/admin/users', adminOnly: true },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}> 
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Explore tools and settings</Text>
      </View>

      <View style={styles.appsSection} testID="more-applications-section">
        <Text style={styles.appsEyebrow}>More → Applications</Text>
        <Text style={styles.appsTitle}>Applications</Text>
        <View style={styles.appsGrid}>
          {APPLICATION_ITEMS.map((item) => (
            <ScalePressable
              key={item.label}
              style={[styles.appCard, item.featured && styles.appCardFeatured, dark && styles.appCardDark, item.disabled && styles.appCardDisabled]}
              onPress={() => item.route && router.push(item.route as any)}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}. ${item.subtitle}`}
              accessibilityState={{ disabled: item.disabled }}
              disabled={item.disabled}
            >
              <View style={[styles.appIcon, item.featured && styles.appIconFeatured]}><Ionicons name={item.icon} size={24} color={item.featured ? '#fff' : COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.appTitle}>{item.label}</Text>
                <Text style={styles.appSubtitle}>{item.subtitle}</Text>
              </View>
              {item.disabled ? <Text style={styles.comingSoon}>Soon</Text> : <View style={styles.chevronBubble}><Ionicons name="chevron-forward" size={18} color={COLORS.primary} /></View>}
            </ScalePressable>
          ))}
        </View>
      </View>

      <View style={styles.grid}>
        {MORE_ITEMS.filter((item) => (item.adminOnly ? isAdmin : true)).map((item) => (
          <ScalePressable key={item.route} style={styles.card} onPress={() => router.push(item.route as any)}>
            <Ionicons name={item.icon} size={20} color={COLORS.primary} />
            <Text style={styles.cardText}>{item.label}</Text>
          </ScalePressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  header: { paddingBottom: SPACING.md },
  title: { ...TYPOGRAPHY.title, color: COLORS.text, letterSpacing: -0.6 },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginTop: 4 },
  appsSection: {
    marginBottom: SPACING.lg,
    borderRadius: 28,
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3E6BE',
    ...SHADOWS.card,
  },
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
  appCardDark: { backgroundColor: '#0f172a' },
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
  chevronBubble: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EFFAF5', alignItems: 'center', justifyContent: 'center' },
  comingSoon: { color: COLORS.secondary, fontSize: 12, fontWeight: '900' },
  grid: { gap: SPACING.sm },
  card: {
    minHeight: 66,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#F2E7C8',
    shadowColor: '#0F3D35',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  cardText: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '800', letterSpacing: -0.1 },
});
