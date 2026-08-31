import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

const THEME = {
  primary: '#005F46',
  primaryLight: '#0B6B53',
  gold: '#C8A84E',
  background: '#F7F8F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F4F2',
  textMain: '#12332A',
  textMuted: '#60736B',
  border: '#E2E8E4',
};

type ActionItem = {
  id: string;
  label: string;
  subLabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
};

type ActionCategory = {
  title: string;
  items: ActionItem[];
};

const ACTION_CATEGORIES: ActionCategory[] = [
  {
    title: 'Academic & Faculty',
    items: [
      { id: 'users', label: 'Approve Students', subLabel: 'Roster Review', icon: 'person-add-outline', route: '/admin/users', color: '#10B981' },
      { id: 'teachers', label: 'Manage Faculty', subLabel: 'Teachers Roster', icon: 'people-outline', route: '/admin/users', color: '#3B82F6' },
      { id: 'courses', label: 'Manage Courses', subLabel: 'LMS Curriculum', icon: 'school-outline', route: '/admin/manage-academics', color: '#8B5CF6' },
      { id: 'library', label: 'Manage Library', subLabel: 'Publish Books', icon: 'book-outline', route: '/admin/add-book', color: '#06B6D4' },
      { id: 'attendance', label: 'Class Attendance', subLabel: 'Student Logs', icon: 'calendar-outline', route: '/attendance', color: '#6366F1' },
    ],
  },
  {
    title: 'Operations & Broadcasting',
    items: [
      { id: 'live', label: 'Create Live Class', subLabel: 'Stream Host', icon: 'videocam-outline', route: '/live-class', color: '#EF4444' },
      { id: 'recording', label: 'Upload Recording', subLabel: 'Lesson Video', icon: 'cloud-upload-outline', route: '/admin/manage-academics', color: '#F59E0B' },
      { id: 'payments', label: 'Manage Payments', subLabel: 'Financial Audit', icon: 'card-outline', route: '/admin/payments', color: '#10B981' },
    ],
  },
  {
    title: 'Communication & Outreach',
    items: [
      { id: 'notify', label: 'Send Broadcast', subLabel: 'Notice Board', icon: 'notifications-outline', route: '/admin/send-push', color: '#EC4899' },
      { id: 'push', label: 'Push Notifications', subLabel: 'FCM Alerts', icon: 'megaphone-outline', route: '/admin/send-push', color: '#8B5CF6' },
    ],
  },
  {
    title: 'Governance & Security',
    items: [
      { id: 'analytics', label: 'Analytics Dashboard', subLabel: 'LMS Telemetry', icon: 'bar-chart-outline', route: '/admin/analytics', color: '#3B82F6' },
      { id: 'moderation', label: 'Moderation Queue', subLabel: 'Community Review', icon: 'shield-checkmark-outline', route: '/admin/moderation', color: '#F97316' },
      { id: 'security', label: 'Security Diagnostics', subLabel: 'System Audit', icon: 'lock-closed-outline', route: '/admin/security', color: '#EF4444' },
      { id: 'privacy', label: 'Privacy & GDPR', subLabel: 'Data Inquiries', icon: 'document-lock-outline', route: '/admin/privacy-requests', color: '#64748B' },
    ],
  },
];

const { width } = Dimensions.get('window');
const IS_TABLET = width > 768;

export const QuickAdminActions = React.memo(function QuickAdminActions() {
  const router = useRouter();

  const handlePress = useCallback((route: string) => {
    try {
      router.push(route as any);
    } catch (e) {
      console.warn('[QuickAdminActions] Navigation error:', e);
    }
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Ionicons name="grid-outline" size={17} color={THEME.primary} />
          <Text style={styles.title}>Administrative Control Center</Text>
        </View>
        <Text style={styles.subtitle}>Enterprise LMS</Text>
      </View>

      {ACTION_CATEGORIES.map((category) => (
        <View key={category.title} style={styles.categorySection}>
          <Text style={styles.categoryTitle}>{category.title}</Text>
          <View style={styles.grid}>
            {category.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.actionCard, IS_TABLET ? styles.actionCardTablet : styles.actionCardMobile]}
                onPress={() => handlePress(item.route)}
                activeOpacity={0.75}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Navigate to ${item.label}`}
              >
                <View style={[styles.iconBox, { backgroundColor: `${item.color}15` }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.subLabel ? (
                    <Text style={styles.actionSubLabel} numberOfLines={1}>
                      {item.subLabel}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={14} color={THEME.textMuted} style={styles.chevron} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: THEME.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    marginBottom: SPACING.xs,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textMain,
  },
  subtitle: {
    fontSize: 11,
    color: THEME.textMuted,
    fontWeight: '600',
  },
  categorySection: {
    marginTop: SPACING.sm,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: THEME.surfaceAlt,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: THEME.border,
    minHeight: 52,
    gap: 8,
  },
  actionCardMobile: {
    width: '48.5%',
  },
  actionCardTablet: {
    width: '32%',
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMain,
  },
  actionSubLabel: {
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 1,
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 'auto',
  },
});
