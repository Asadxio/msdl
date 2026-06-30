import { ScreenRefreshControl, ScalePressable } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';

type MoreItem = {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

type Category = {
  title: string;
  colorBg: string;
  colorIcon: string;
  adminOnly?: boolean;
  items: MoreItem[];
};

const CATEGORIES: Category[] = [
  {
    title: 'Learning',
    colorBg: '#EEF2FF',
    colorIcon: '#4F46E5',
    items: [
      { label: 'Library', subtitle: 'Course materials and books', icon: 'library-outline', route: '/more/library' },
      { label: 'Quiz', subtitle: 'Tests and assessments', icon: 'help-circle-outline', route: '/more/quiz' },
      { label: 'Recordings', subtitle: 'Watch lesson recordings', icon: 'play-circle-outline', route: '/recordings' },
      { label: 'Teachers', subtitle: 'Meet your teachers', icon: 'people-outline', route: '/more/teachers' },
    ]
  },
  {
    title: 'Student Services',
    colorBg: '#ECFDF5',
    colorIcon: '#10B981',
    items: [
      { label: 'Attendance', subtitle: 'Track your attendance', icon: 'calendar-outline', route: '/more/attendance' },
      { label: 'Payment History', subtitle: 'View your payment records', icon: 'receipt-outline', route: '/payment-history' },
      { label: 'Applications', subtitle: 'Islamic tools and features', icon: 'apps-outline', route: '/more/applications' },
      { label: 'Announcements', subtitle: 'Live status and announcements', icon: 'radio-outline', route: '/status' },
    ]
  },
  {
    title: 'App & Settings',
    colorBg: '#F8FAFC',
    colorIcon: '#64748B',
    items: [
      { label: 'Settings', subtitle: 'App preferences and account', icon: 'settings-outline', route: '/settings' },
      { label: 'Privacy Policy', subtitle: 'Review your privacy rights', icon: 'shield-checkmark-outline', route: '/privacy' },
      { label: 'Terms & Conditions', subtitle: 'View app terms', icon: 'document-text-outline', route: '/terms' },
      { label: 'Community Guidelines', subtitle: 'Respectful behavior rules', icon: 'people-outline', route: '/community-guidelines' },
      { label: 'Data & Privacy Controls', subtitle: 'Manage your data settings', icon: 'lock-closed-outline', route: '/data-privacy' },
    ]
  },
  {
    title: 'Support',
    colorBg: '#FEF3C7',
    colorIcon: '#D97706',
    items: [
      { label: 'About & Donations', subtitle: 'App info and support', icon: 'heart-outline', route: '/payment' },
    ]
  },
  {
    title: 'Admin Controls',
    colorBg: '#FFF1F2',
    colorIcon: '#E11D48',
    adminOnly: true,
    items: [
      { label: 'Manage Academics', subtitle: 'Admin controls for academics', icon: 'school-outline', route: '/admin/manage-academics' },
      { label: 'Admin Payments', subtitle: 'Admin billing tools', icon: 'card-outline', route: '/admin/payments' },
      { label: 'Admin Users', subtitle: 'Manage registered users', icon: 'people-circle-outline', route: '/admin/users' },
      { label: 'Analytics Dashboard', subtitle: 'Platform-wide metrics and reports', icon: 'bar-chart-outline', route: '/admin/analytics' },
      { label: 'Moderation Queue', subtitle: 'Review flagged content and reports', icon: 'flag-outline', route: '/admin/moderation' },
      { label: 'Security Dashboard', subtitle: 'Monitor security events and access', icon: 'shield-outline', route: '/admin/security' },
      { label: 'Send Push Notifications', subtitle: 'Broadcast messages to users', icon: 'notifications-outline', route: '/admin/send-push' },
    ]
  }
];

export default function MoreLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const { lessonProgress } = useData();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await new Promise(r => setTimeout(r, 500));
  });

  const initials = useMemo(() => {
    const name = profile?.name || user?.displayName || 'Student';
    return name.substring(0, 2).toUpperCase();
  }, [profile?.name, user?.displayName]);

  const memberSince = useMemo(() => {
    if (user?.metadata?.creationTime) {
      return new Date(user.metadata.creationTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
    }
    return 'Recently';
  }, [user?.metadata?.creationTime]);

  const lessonsCompleted = useMemo(() => {
    if (!lessonProgress) return 0;
    return Object.values(lessonProgress).filter(p => p.completed).length;
  }, [lessonProgress]);
  
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.lg }]} 
      showsVerticalScrollIndicator={false} 
      refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Student Services</Text>
        <Text style={styles.subtitle}>Everything you need for learning, student services, and account management.</Text>
      </View>

      <ScalePressable style={styles.profileCard} onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="View Profile">
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitials}>{initials}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>{profile?.name || user?.displayName || 'Student'}</Text>
          <View style={styles.profileBadges}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Student'}</Text>
            </View>
          </View>
          <Text style={styles.profileMeta} numberOfLines={1}>{user?.email || profile?.email}</Text>
          <Text style={styles.profileMeta}>Member since {memberSince}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </ScalePressable>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="book" size={24} color="#4F46E5" />
          </View>
          <Text style={styles.statValue}>{lessonsCompleted}</Text>
          <Text style={styles.statLabel}>Lessons Completed</Text>
        </View>
      </View>

      {CATEGORIES.map((category) => {
        if (category.adminOnly && !isAdmin) return null;

        return (
          <View key={category.title} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <View style={styles.categoryList}>
              {category.items.map((item) => (
                <ScalePressable
                  key={item.route}
                  style={styles.rowCard}
                  onPress={() => router.push(item.route as any)}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <View style={[styles.rowIconContainer, { backgroundColor: category.colorBg }]}>
                    <Ionicons name={item.icon} size={22} color={category.colorIcon} />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                </ScalePressable>
              ))}
            </View>
          </View>
        );
      })}

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>Madrasa Tus Salikat Lil Banat</Text>
        <Text style={styles.footerVersion}>Version {appVersion}</Text>
        <Text style={styles.footerCopyright}>© All Rights Reserved</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl + 40 },
  header: { marginBottom: SPACING.xl },
  title: { ...TYPOGRAPHY.title, color: '#0F172A', letterSpacing: -0.5, fontWeight: '800' },
  subtitle: { ...TYPOGRAPHY.body, color: '#64748B', marginTop: 8, lineHeight: 22 },
  
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOWS.card,
    shadowOpacity: 0.05,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  profileInitials: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 1,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  profileBadges: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  profileMeta: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: SPACING.md,
    ...SHADOWS.card,
    shadowOpacity: 0.04,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  categorySection: {
    marginBottom: SPACING.xl,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: SPACING.md,
    marginLeft: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  categoryList: {
    gap: SPACING.sm,
  },
  
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    ...SHADOWS.card,
    shadowOpacity: 0.04,
    minHeight: 76,
  },
  rowIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { 
    flex: 1,
    justifyContent: 'center',
  },
  rowLabel: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#0F172A',
    marginBottom: 2,
  },
  rowSubtitle: { 
    fontSize: 13, 
    color: '#64748B',
    fontWeight: '400',
  },

  footer: {
    alignItems: 'center',
    marginTop: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
  },
  footerVersion: {
    fontSize: 12,
    color: '#CBD5E1',
    marginBottom: 2,
  },
  footerCopyright: {
    fontSize: 12,
    color: '#CBD5E1',
  },
});
