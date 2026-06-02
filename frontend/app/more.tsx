import React from 'react';
import { View, Text, StyleSheet, ScrollView, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { ScalePressable } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

type MoreItem = { label: string; icon: keyof typeof Ionicons.glyphMap; route: string; adminOnly?: boolean };
type AppItem = { label: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; route?: string; disabled?: boolean };

const APPLICATION_ITEMS: AppItem[] = [
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
              style={[styles.appCard, dark && styles.appCardDark, item.disabled && styles.appCardDisabled]}
              onPress={() => item.route && router.push(item.route as any)}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}. ${item.subtitle}`}
              accessibilityState={{ disabled: item.disabled }}
              disabled={item.disabled}
            >
              <View style={styles.appIcon}><Ionicons name={item.icon} size={24} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.appTitle}>{item.label}</Text>
                <Text style={styles.appSubtitle}>{item.subtitle}</Text>
              </View>
              {item.disabled ? <Text style={styles.comingSoon}>Soon</Text> : <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />}
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
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  appsSection: { marginBottom: SPACING.lg },
  appsEyebrow: { color: COLORS.secondary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  appsTitle: { ...TYPOGRAPHY.heading, color: COLORS.textMain, fontSize: 22, marginTop: 3, marginBottom: SPACING.md },
  appsGrid: { gap: SPACING.sm },
  appCard: {
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  appCardDark: { backgroundColor: '#0f172a' },
  appCardDisabled: { opacity: 0.62 },
  appIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.goldBg, alignItems: 'center', justifyContent: 'center' },
  appTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  appSubtitle: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', marginTop: 3, lineHeight: 17 },
  comingSoon: { color: COLORS.secondary, fontSize: 12, fontWeight: '900' },
  grid: { gap: SPACING.sm },
  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  cardText: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '600' },
});
