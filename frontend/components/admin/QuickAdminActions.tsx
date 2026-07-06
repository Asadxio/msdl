import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

type ActionItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color?: string;
};

const ACTIONS: ActionItem[] = [
  { id: 'users', label: 'Approve Students', icon: 'person-add-outline', route: '/admin/users', color: '#10B981' },
  { id: 'teachers', label: 'Manage Teachers', icon: 'people-outline', route: '/admin/users', color: '#3B82F6' },
  { id: 'courses', label: 'Manage Courses', icon: 'school-outline', route: '/admin/manage-academics', color: '#8B5CF6' },
  { id: 'live', label: 'Create Live Class', icon: 'videocam-outline', route: '/live-class', color: '#EF4444' },
  { id: 'recording', label: 'Upload Recording', icon: 'cloud-upload-outline', route: '/admin/manage-academics', color: '#F59E0B' },
  { id: 'library', label: 'Manage Library', icon: 'book-outline', route: '/admin/add-book', color: '#06B6D4' },
  { id: 'notify', label: 'Send Notification', icon: 'notifications-outline', route: '/admin/send-push', color: '#EC4899' },
  { id: 'payments', label: 'Manage Payments', icon: 'card-outline', route: '/admin/payments', color: '#10B981' },
  { id: 'attendance', label: 'Attendance', icon: 'calendar-outline', route: '/attendance', color: '#6366F1' },
  { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline', route: '/admin/analytics', color: '#3B82F6' },
  { id: 'moderation', label: 'Moderation', icon: 'shield-checkmark-outline', route: '/admin/moderation', color: '#F97316' },
  { id: 'security', label: 'Security', icon: 'lock-closed-outline', route: '/admin/security', color: '#EF4444' },
  { id: 'push', label: 'Push Notifications', icon: 'megaphone-outline', route: '/admin/send-push', color: '#8B5CF6' },
  { id: 'privacy', label: 'Privacy Requests', icon: 'document-lock-outline', route: '/admin/privacy-requests', color: '#64748B' },
];

const { width } = Dimensions.get('window');
const COLUMN_COUNT = width > 768 ? 4 : 3;

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
          <Ionicons name="grid-outline" size={18} color={COLORS.primary} />
          <Text style={styles.title}>Quick Admin Actions</Text>
        </View>
        <Text style={styles.subtitle}>Enterprise Controls</Text>
      </View>
      <View style={styles.grid}>
        {ACTIONS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.actionCard, { width: `${100 / COLUMN_COUNT - 2}%` }]}
            onPress={() => handlePress(item.route)}
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Navigate to ${item.label}`}
          >
            <View style={[styles.iconBox, { backgroundColor: `${item.color || COLORS.primary}15` }]}>
              <Ionicons name={item.icon} size={22} color={item.color || COLORS.primary} />
            </View>
            <Text style={styles.actionLabel} numberOfLines={2} ellipsizeMode="tail">
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  actionCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: 4,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 84,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 14,
  },
});
