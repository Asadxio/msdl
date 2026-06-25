import { ScreenRefreshControl } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScalePressable } from '@/components/ui';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

type MoreItem = {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  adminOnly?: boolean;
};

const MORE_ITEMS: MoreItem[] = [
  { label: 'Applications', subtitle: 'Islamic tools and features', icon: 'apps-outline', route: '/more/applications' },
  { label: 'Library', subtitle: 'Course materials and books', icon: 'library-outline', route: '/more/library' },
  { label: 'Attendance', subtitle: 'Track your attendance', icon: 'calendar-outline', route: '/more/attendance' },
  { label: 'Quiz', subtitle: 'Tests and assessments', icon: 'help-circle-outline', route: '/more/quiz' },
  { label: 'Recordings', subtitle: 'Watch lesson recordings', icon: 'play-circle-outline', route: '/recordings' },
  { label: 'Status', subtitle: 'Live status and announcements', icon: 'radio-outline', route: '/status' },
  { label: 'Teachers', subtitle: 'Meet your teachers', icon: 'people-outline', route: '/more/teachers' },
  { label: 'Payment History', subtitle: 'View your payment records', icon: 'receipt-outline', route: '/payment-history' },
  { label: 'Settings', subtitle: 'App preferences and account', icon: 'settings-outline', route: '/settings' },
  { label: 'Privacy Policy', subtitle: 'Review your privacy rights', icon: 'shield-checkmark-outline', route: '/privacy' },
  { label: 'Terms & Conditions', subtitle: 'View app terms', icon: 'document-text-outline', route: '/terms' },
  { label: 'Community Guidelines', subtitle: 'Respectful behavior rules', icon: 'people-outline', route: '/community-guidelines' },
  { label: 'Data & Privacy Controls', subtitle: 'Manage your data settings', icon: 'lock-closed-outline', route: '/data-privacy' },
  { label: 'About & Donations', subtitle: 'App info and support', icon: 'heart-outline', route: '/payment' },
  { label: 'Manage Academics', subtitle: 'Admin controls for academics', icon: 'school-outline', route: '/admin/manage-academics', adminOnly: true },
  { label: 'Admin Payments', subtitle: 'Admin billing tools', icon: 'card-outline', route: '/admin/payments', adminOnly: true },
  { label: 'Admin Users', subtitle: 'Manage registered users', icon: 'people-circle-outline', route: '/admin/users', adminOnly: true },
  { label: 'Analytics Dashboard', subtitle: 'Platform-wide metrics and reports', icon: 'bar-chart-outline', route: '/admin/analytics', adminOnly: true },
  { label: 'Moderation Queue', subtitle: 'Review flagged content and reports', icon: 'flag-outline', route: '/admin/moderation', adminOnly: true },
  { label: 'Security Dashboard', subtitle: 'Monitor security events and access', icon: 'shield-outline', route: '/admin/security', adminOnly: true },
  { label: 'Send Push Notifications', subtitle: 'Broadcast messages to users', icon: 'notifications-outline', route: '/admin/send-push', adminOnly: true },
];

export default function MoreLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';


  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await new Promise(r => setTimeout(r, 500));
  });
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.lg }]} showsVerticalScrollIndicator={false} refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Explore tools and settings</Text>
      </View>

      <View style={styles.list}> 
        {MORE_ITEMS.filter((item) => (item.adminOnly ? isAdmin : true)).map((item) => (
          <ScalePressable
            key={item.route}
            style={styles.rowCard}
            onPress={() => router.push(item.route as any)}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}. ${item.subtitle}`}
          >
            <View style={styles.rowIconContainer}>
              <View style={styles.rowIconBackground}>
                <Ionicons name={item.icon} size={20} color="#fff" />
              </View>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </ScalePressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  header: { marginBottom: SPACING.lg },
  title: { ...TYPOGRAPHY.title, color: '#1B4332', letterSpacing: -0.5 },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted, marginTop: 6 },
  list: { gap: SPACING.sm },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(27, 67, 50, 0.08)',
    ...SHADOWS.card,
  },
  rowIconContainer: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B4332',
  },
  rowIconBackground: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: '800', color: '#1B4332' },
  rowSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
});
